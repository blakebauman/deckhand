package server

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
)

var errUnauthorized = errors.New("unauthorized")

// NewToken returns a fresh random token for one sidecar launch.
func NewToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// presentedToken extracts the token a caller supplied.
//
// Browsers cannot set headers on EventSource, WebSocket, or window.open, and
// the UI drives log/event/exec/export endpoints through exactly those, so a
// ?token= query parameter is accepted as equivalent to the bearer header.
func presentedToken(r *http.Request) string {
	if h := r.Header.Get("Authorization"); h != "" {
		if len(h) > 7 && strings.EqualFold(h[:7], "bearer ") {
			return strings.TrimSpace(h[7:])
		}
		return ""
	}
	return strings.TrimSpace(r.URL.Query().Get("token"))
}

// tokenAllowed compares in constant time. An empty want disables auth, which
// only happens when the operator passes --no-auth.
func tokenAllowed(want, got string) bool {
	if want == "" {
		return true
	}
	return subtle.ConstantTimeCompare([]byte(want), []byte(got)) == 1
}

// setCORS echoes an origin back to an already-authenticated caller.
//
// The allowlist is the token itself rather than a fixed set of origins: the
// Tauri webview's origin differs per platform (tauri://localhost on macOS,
// http://tauri.localhost elsewhere), so hardcoding one risks breaking the app
// on a platform we cannot test here. A caller holding an unguessable
// per-launch token is authorized regardless of which origin it came from.
func setCORS(w http.ResponseWriter, origin string) {
	if origin == "" {
		return // non-browser client (CLI, curl); nothing to negotiate
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Add("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
}

// guard authenticates every request and negotiates CORS. It replaces the
// previous middleware, which set Access-Control-Allow-Origin: * with no auth
// at all — that let any page the user visited drive the Docker daemon.
func (s *Server) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// A CORS preflight never carries the Authorization header, so it must
		// be answered before the token check. It reveals nothing on its own;
		// the request it precedes still has to present the token.
		if r.Method == http.MethodOptions {
			setCORS(w, origin)
			w.WriteHeader(http.StatusNoContent)
			return
		}

		if !tokenAllowed(s.token, presentedToken(r)) {
			// Deliberately no CORS headers here: a cross-origin page that
			// guessed wrong must not be able to read the rejection either.
			writeErr(w, http.StatusUnauthorized, errUnauthorized)
			return
		}

		setCORS(w, origin)
		next.ServeHTTP(w, r)
	})
}
