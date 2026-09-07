package docker

import (
	"testing"

	"github.com/docker/docker/api/types/mount"
)

func TestNormalizeEnv(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{name: "nil stays empty", in: nil, want: []string{}},
		{name: "pairs pass through", in: []string{"A=1", "B=2"}, want: []string{"A=1", "B=2"}},
		{name: "surrounding whitespace trimmed", in: []string{"  A=1  "}, want: []string{"A=1"}},
		{name: "blank entries dropped", in: []string{"A=1", "", "   ", "B=2"}, want: []string{"A=1", "B=2"}},

		// Docker treats a bare name as "inherit from the daemon environment",
		// which is not what a user typing a name into the run form means.
		{name: "bare name gains a trailing equals", in: []string{"DEBUG"}, want: []string{"DEBUG="}},
		{name: "explicitly empty value preserved", in: []string{"DEBUG="}, want: []string{"DEBUG="}},

		{name: "value containing equals is untouched", in: []string{"URL=http://x/?a=b"}, want: []string{"URL=http://x/?a=b"}},
		{name: "value whitespace is preserved", in: []string{"MSG=hello world"}, want: []string{"MSG=hello world"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeEnv(tc.in)
			if len(got) != len(tc.want) {
				t.Fatalf("normalizeEnv(%q) = %q, want %q", tc.in, got, tc.want)
			}
			for i := range tc.want {
				if got[i] != tc.want[i] {
					t.Errorf("normalizeEnv(%q)[%d] = %q, want %q", tc.in, i, got[i], tc.want[i])
				}
			}
		})
	}
}

func TestNormalizeLabels(t *testing.T) {
	t.Run("nil and empty collapse to nil", func(t *testing.T) {
		if got := normalizeLabels(nil); got != nil {
			t.Errorf("normalizeLabels(nil) = %v, want nil", got)
		}
		if got := normalizeLabels(map[string]string{}); got != nil {
			t.Errorf("normalizeLabels(empty) = %v, want nil", got)
		}
	})

	t.Run("keys and values are trimmed", func(t *testing.T) {
		got := normalizeLabels(map[string]string{"  app  ": "  nginx  "})
		if got["app"] != "nginx" {
			t.Errorf("normalizeLabels = %v, want app=nginx", got)
		}
	})

	t.Run("blank keys are dropped", func(t *testing.T) {
		got := normalizeLabels(map[string]string{"": "v", "   ": "v", "ok": "v"})
		if len(got) != 1 || got["ok"] != "v" {
			t.Errorf("normalizeLabels = %v, want only ok=v", got)
		}
	})

	t.Run("all-blank keys collapse to nil", func(t *testing.T) {
		if got := normalizeLabels(map[string]string{"": "v", "  ": "v"}); got != nil {
			t.Errorf("normalizeLabels = %v, want nil so no label filter is sent", got)
		}
	})

	t.Run("empty values are kept", func(t *testing.T) {
		got := normalizeLabels(map[string]string{"marker": ""})
		v, ok := got["marker"]
		if !ok || v != "" {
			t.Errorf("normalizeLabels = %v, want marker present with an empty value", got)
		}
	})
}

func TestParseMountsInfersType(t *testing.T) {
	tests := []struct {
		name string
		spec MountSpec
		want mount.Type
	}{
		{name: "absolute unix path is a bind", spec: MountSpec{Source: "/srv/data", Target: "/data"}, want: mount.TypeBind},
		{name: "dot-relative path is a bind", spec: MountSpec{Source: "./data", Target: "/data"}, want: mount.TypeBind},
		{name: "parent-relative path is a bind", spec: MountSpec{Source: "../data", Target: "/data"}, want: mount.TypeBind},
		{name: "windows drive letter is a bind", spec: MountSpec{Source: `C:\data`, Target: "/data"}, want: mount.TypeBind},
		{name: "bare name is a volume", spec: MountSpec{Source: "mydata", Target: "/data"}, want: mount.TypeVolume},
		{name: "name with a dash is a volume", spec: MountSpec{Source: "my-data", Target: "/data"}, want: mount.TypeVolume},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := parseMounts([]MountSpec{tc.spec})
			if err != nil {
				t.Fatalf("parseMounts: %v", err)
			}
			if got[0].Type != tc.want {
				t.Errorf("inferred type = %q, want %q", got[0].Type, tc.want)
			}
		})
	}
}

func TestParseMountsExplicitType(t *testing.T) {
	tests := []struct {
		name string
		typ  string
		want mount.Type
	}{
		{name: "bind", typ: "bind", want: mount.TypeBind},
		{name: "volume", typ: "volume", want: mount.TypeVolume},
		{name: "tmpfs", typ: "tmpfs", want: mount.TypeTmpfs},
		{name: "uppercase is accepted", typ: "BIND", want: mount.TypeBind},
		{name: "padded is accepted", typ: "  volume  ", want: mount.TypeVolume},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// An explicit type must win over what the source path implies.
			got, err := parseMounts([]MountSpec{{Type: tc.typ, Source: "/abs/path", Target: "/data"}})
			if err != nil {
				t.Fatalf("parseMounts: %v", err)
			}
			if got[0].Type != tc.want {
				t.Errorf("type = %q, want %q", got[0].Type, tc.want)
			}
		})
	}
}

func TestParseMountsTmpfsDropsSource(t *testing.T) {
	// Docker rejects a tmpfs mount that carries a source.
	got, err := parseMounts([]MountSpec{{Type: "tmpfs", Source: "/ignored", Target: "/tmp"}})
	if err != nil {
		t.Fatalf("parseMounts: %v", err)
	}
	if got[0].Source != "" {
		t.Errorf("tmpfs Source = %q, want it cleared", got[0].Source)
	}
}

func TestParseMountsErrors(t *testing.T) {
	tests := []struct {
		name string
		spec MountSpec
	}{
		{name: "missing source", spec: MountSpec{Target: "/data"}},
		{name: "missing target", spec: MountSpec{Source: "/srv"}},
		{name: "blank source", spec: MountSpec{Source: "   ", Target: "/data"}},
		{name: "blank target", spec: MountSpec{Source: "/srv", Target: "  "}},
		{name: "unsupported type", spec: MountSpec{Type: "npipe", Source: "/srv", Target: "/data"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := parseMounts([]MountSpec{tc.spec}); err == nil {
				t.Errorf("parseMounts(%+v) succeeded, want an error", tc.spec)
			}
		})
	}
}

func TestParseMountsEmptyAndPreservesOrder(t *testing.T) {
	got, err := parseMounts(nil)
	if err != nil || got != nil {
		t.Errorf("parseMounts(nil) = %v, %v; want nil, nil", got, err)
	}

	specs := []MountSpec{
		{Source: "first", Target: "/a"},
		{Source: "/second", Target: "/b", ReadOnly: true},
		{Source: "third", Target: "/c"},
	}
	out, err := parseMounts(specs)
	if err != nil {
		t.Fatalf("parseMounts: %v", err)
	}
	if len(out) != 3 {
		t.Fatalf("got %d mounts, want 3", len(out))
	}
	for i, want := range []string{"first", "/second", "third"} {
		if out[i].Source != want {
			t.Errorf("mount %d source = %q, want %q", i, out[i].Source, want)
		}
	}
	if !out[1].ReadOnly || out[0].ReadOnly {
		t.Errorf("ReadOnly not carried through per-mount: %+v", out)
	}
}
