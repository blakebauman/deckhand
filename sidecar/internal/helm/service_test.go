package helm

import (
	"os"
	"strings"
	"testing"
)

func TestParseReleaseList(t *testing.T) {
	t.Run("maps helm's snake_case fields", func(t *testing.T) {
		out := `[{"name":"ingress","namespace":"kube-system","revision":3,"status":"deployed",
		          "chart":"ingress-nginx-4.10.0","app_version":"1.10.0","updated":"2026-01-02 10:00:00"}]`
		releases, err := parseReleaseList(out)
		if err != nil {
			t.Fatalf("parseReleaseList: %v", err)
		}
		if len(releases) != 1 {
			t.Fatalf("got %d releases, want 1", len(releases))
		}
		want := ReleaseSummary{
			Name: "ingress", Namespace: "kube-system", Revision: "3", Status: "deployed",
			Chart: "ingress-nginx-4.10.0", AppVersion: "1.10.0", Updated: "2026-01-02 10:00:00",
		}
		if releases[0] != want {
			t.Errorf("release = %+v, want %+v", releases[0], want)
		}
	})

	t.Run("revision is a JSON number but reaches the UI as a plain integer", func(t *testing.T) {
		releases, err := parseReleaseList(`[{"name":"a","revision":12}]`)
		if err != nil {
			t.Fatalf("parseReleaseList: %v", err)
		}
		if releases[0].Revision != "12" {
			t.Errorf("Revision = %q, want %q (not a float rendering)", releases[0].Revision, "12")
		}
	})

	t.Run("missing fields render empty, not <nil>", func(t *testing.T) {
		releases, err := parseReleaseList(`[{"name":"a"}]`)
		if err != nil {
			t.Fatalf("parseReleaseList: %v", err)
		}
		got := releases[0]
		if got.Revision != "" || got.Status != "" || got.AppVersion != "" {
			t.Errorf("release = %+v, want empty strings for the absent fields", got)
		}
	})

	t.Run("no releases", func(t *testing.T) {
		releases, err := parseReleaseList(`[]`)
		if err != nil {
			t.Fatalf("parseReleaseList: %v", err)
		}
		if releases == nil || len(releases) != 0 {
			t.Errorf("parseReleaseList([]) = %v, want an empty, non-nil slice", releases)
		}
	})

	t.Run("unparseable output", func(t *testing.T) {
		if _, err := parseReleaseList("Error: Kubernetes cluster unreachable"); err == nil {
			t.Error("expected an error for non-JSON output")
		}
	})
}

func TestMaybeValuesFile(t *testing.T) {
	t.Run("blank yaml adds nothing", func(t *testing.T) {
		for _, yaml := range []string{"", "   \n\t"} {
			args := []string{"install", "web", "./chart"}
			cleanup, err := maybeValuesFile(yaml, &args)
			if err != nil {
				t.Fatalf("maybeValuesFile(%q): %v", yaml, err)
			}
			if cleanup != nil {
				t.Errorf("maybeValuesFile(%q) returned a cleanup func with no file written", yaml)
			}
			if len(args) != 3 {
				t.Errorf("args = %q, want them untouched", args)
			}
		}
	})

	t.Run("yaml is written and passed with -f", func(t *testing.T) {
		args := []string{"install", "web", "./chart"}
		cleanup, err := maybeValuesFile("replicaCount: 2\n", &args)
		if err != nil {
			t.Fatalf("maybeValuesFile: %v", err)
		}
		if cleanup == nil {
			t.Fatal("a written values file must come with a cleanup func")
		}
		if len(args) != 5 || args[3] != "-f" {
			t.Fatalf("args = %q, want a trailing -f <path>", args)
		}

		path := args[4]
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(body), "replicaCount: 2") {
			t.Errorf("values file = %q, want the request's YAML", body)
		}

		// Values commonly carry credentials, so the temp file must not be
		// readable by other local accounts.
		st, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if perm := st.Mode().Perm(); perm != 0o600 {
			t.Errorf("values file mode = %o, want 600", perm)
		}

		cleanup()
		if _, err := os.Stat(path); !os.IsNotExist(err) {
			t.Errorf("cleanup left %q behind (err=%v)", path, err)
		}
	})
}

func TestStr(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want string
	}{
		{name: "nil", in: nil, want: ""},
		{name: "string", in: "deployed", want: "deployed"},
		{name: "json number", in: float64(7), want: "7"},
		{name: "bool", in: true, want: "true"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := str(tc.in); got != tc.want {
				t.Errorf("str(%v) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
