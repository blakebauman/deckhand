package server

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestPresentedToken(t *testing.T) {
	tests := []struct {
		name   string
		header string
		query  string
		want   string
	}{
		{name: "bearer header", header: "Bearer abc123", want: "abc123"},
		{name: "bearer is case insensitive", header: "bEaReR abc123", want: "abc123"},
		{name: "bearer value is trimmed", header: "Bearer   abc123  ", want: "abc123"},
		{name: "query parameter", query: "abc123", want: "abc123"},
		{name: "query value is trimmed", query: "  abc123 ", want: "abc123"},
		{name: "nothing presented", want: ""},

		// Guard against a malformed header silently falling through to the
		// query parameter, which would let a caller mix transports.
		{name: "non-bearer scheme yields nothing", header: "Basic abc123", query: "abc123", want: ""},
		{name: "bare token without scheme yields nothing", header: "abc123", want: ""},
		{name: "scheme with no value yields nothing", header: "Bearer", want: ""},
		{name: "header wins over query", header: "Bearer fromheader", query: "fromquery", want: "fromheader"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			target := "/api/status"
			if tc.query != "" {
				// Escape so the raw target stays a valid URL; presentedToken
				// reads the decoded value, so trimming is still exercised.
				target += "?token=" + url.QueryEscape(tc.query)
			}
			r := httptest.NewRequest(http.MethodGet, target, nil)
			if tc.header != "" {
				r.Header.Set("Authorization", tc.header)
			}
			if got := presentedToken(r); got != tc.want {
				t.Errorf("presentedToken() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestTokenAllowed(t *testing.T) {
	tests := []struct {
		name string
		want string
		got  string
		ok   bool
	}{
		{name: "exact match", want: "secret", got: "secret", ok: true},
		{name: "wrong token", want: "secret", got: "guess", ok: false},
		{name: "empty presentation", want: "secret", got: "", ok: false},
		{name: "prefix is not enough", want: "secret", got: "sec", ok: false},
		{name: "extra suffix rejected", want: "secret", got: "secretx", ok: false},
		{name: "case sensitive", want: "secret", got: "SECRET", ok: false},

		// An empty want means --no-auth; anything is accepted then.
		{name: "auth disabled accepts empty", want: "", got: "", ok: true},
		{name: "auth disabled accepts anything", want: "", got: "whatever", ok: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tokenAllowed(tc.want, tc.got); got != tc.ok {
				t.Errorf("tokenAllowed(%q, %q) = %v, want %v", tc.want, tc.got, got, tc.ok)
			}
		})
	}
}

func TestNewTokenIsRandomAndLongEnough(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		tok, err := NewToken()
		if err != nil {
			t.Fatalf("NewToken() error: %v", err)
		}
		if len(tok) != 64 {
			t.Fatalf("NewToken() length = %d, want 64 hex chars (32 bytes)", len(tok))
		}
		if seen[tok] {
			t.Fatalf("NewToken() returned a duplicate on iteration %d", i)
		}
		seen[tok] = true
	}
}

// guard is the control that stops any web page the user visits from driving
// the Docker daemon, so exercise it as a whole rather than just its parts.
func TestGuardRejectsUnauthenticatedRequests(t *testing.T) {
	reached := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	})
	s := &Server{token: "secret"}
	h := s.guard(next)

	tests := []struct {
		name       string
		target     string
		header     string
		wantStatus int
		wantReach  bool
	}{
		{name: "no credentials", target: "/api/docker/containers", wantStatus: http.StatusUnauthorized},
		{name: "wrong bearer", target: "/api/docker/containers", header: "Bearer nope", wantStatus: http.StatusUnauthorized},
		{name: "wrong query token", target: "/api/docker/containers?token=nope", wantStatus: http.StatusUnauthorized},
		{name: "health is not exempt", target: "/health", wantStatus: http.StatusUnauthorized},
		{name: "valid bearer", target: "/api/docker/containers", header: "Bearer secret", wantStatus: http.StatusOK, wantReach: true},
		{name: "valid query token", target: "/api/docker/containers?token=secret", wantStatus: http.StatusOK, wantReach: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			reached = false
			r := httptest.NewRequest(http.MethodGet, tc.target, nil)
			if tc.header != "" {
				r.Header.Set("Authorization", tc.header)
			}
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)

			if w.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tc.wantStatus)
			}
			if reached != tc.wantReach {
				t.Errorf("handler reached = %v, want %v", reached, tc.wantReach)
			}
		})
	}
}

// A page that cannot authenticate must not be able to read the rejection
// either, so 401s carry no Access-Control-Allow-Origin.
func TestGuardWithholdsCORSFromUnauthenticatedOrigins(t *testing.T) {
	s := &Server{token: "secret"}
	h := s.guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	r := httptest.NewRequest(http.MethodGet, "/api/docker/containers", nil)
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q on a 401, want it absent", got)
	}
}

// CORS mirrors auth: an authenticated caller gets its origin echoed, whatever
// that origin is, because the Tauri webview's origin differs per platform.
func TestGuardEchoesOriginOnceAuthenticated(t *testing.T) {
	s := &Server{token: "secret"}
	h := s.guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	for _, origin := range []string{"tauri://localhost", "http://tauri.localhost", "http://localhost:1420"} {
		t.Run(origin, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/api/docker/containers", nil)
			r.Header.Set("Origin", origin)
			r.Header.Set("Authorization", "Bearer secret")
			w := httptest.NewRecorder()
			h.ServeHTTP(w, r)

			if got := w.Header().Get("Access-Control-Allow-Origin"); got != origin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, origin)
			}
			if got := w.Header().Get("Vary"); !strings.Contains(got, "Origin") {
				t.Errorf("Vary = %q, want it to contain Origin", got)
			}
		})
	}
}

// A preflight never carries the Authorization header, so it has to be answered
// before the token check or the browser never sends the real request.
func TestGuardAnswersPreflightWithoutCredentials(t *testing.T) {
	s := &Server{token: "secret"}
	reached := false
	h := s.guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true }))

	r := httptest.NewRequest(http.MethodOptions, "/api/docker/containers", nil)
	r.Header.Set("Origin", "tauri://localhost")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 204", w.Code)
	}
	if reached {
		t.Error("preflight reached the wrapped handler; it should be answered by the guard")
	}
	if got := w.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(strings.ToLower(got), "authorization") {
		t.Errorf("Access-Control-Allow-Headers = %q, want it to permit Authorization", got)
	}
}

// --no-auth must actually serve, or the documented dev escape hatch is broken.
func TestGuardWithAuthDisabled(t *testing.T) {
	s := &Server{token: ""}
	reached := false
	h := s.guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true }))

	r := httptest.NewRequest(http.MethodGet, "/api/docker/containers", nil)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if !reached || w.Code != http.StatusOK {
		t.Errorf("with auth disabled: reached = %v, status = %d; want true, 200", reached, w.Code)
	}
}
