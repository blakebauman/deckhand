package compose

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func writeFile(t *testing.T, path string) string {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("services: {}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestSplitConfigFiles(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []string
	}{
		{name: "empty", in: "", want: nil},
		{name: "whitespace only", in: "   ", want: nil},
		{name: "single path", in: "/srv/compose.yaml", want: []string{"/srv/compose.yaml"}},
		{
			// `docker compose ls` joins multiple -f files with commas.
			name: "comma separated with padding",
			in:   " /a/compose.yaml , /b/override.yaml ",
			want: []string{"/a/compose.yaml", "/b/override.yaml"},
		},
		{name: "empty segments dropped", in: "/a/compose.yaml,,", want: []string{"/a/compose.yaml"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := splitConfigFiles(tc.in); !slices.Equal(got, tc.want) {
				t.Errorf("splitConfigFiles(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestExistingFiles(t *testing.T) {
	dir := t.TempDir()
	real := writeFile(t, filepath.Join(dir, "compose.yaml"))
	subdir := filepath.Join(dir, "sub")
	if err := os.MkdirAll(subdir, 0o755); err != nil {
		t.Fatal(err)
	}

	t.Run("nil input", func(t *testing.T) {
		if got := existingFiles(nil); got != nil {
			t.Errorf("existingFiles(nil) = %q, want nil", got)
		}
	})

	t.Run("missing paths are dropped", func(t *testing.T) {
		got := existingFiles([]string{real, filepath.Join(dir, "gone.yaml")})
		if !slices.Equal(got, []string{real}) {
			t.Errorf("existingFiles = %q, want %q", got, []string{real})
		}
	})

	t.Run("directories are not compose files", func(t *testing.T) {
		if got := existingFiles([]string{subdir}); len(got) != 0 {
			t.Errorf("existingFiles(dir) = %q, want none", got)
		}
	})

	t.Run("duplicates collapse", func(t *testing.T) {
		got := existingFiles([]string{real, real, "  " + real + "  "})
		if !slices.Equal(got, []string{real}) {
			t.Errorf("existingFiles = %q, want a single %q", got, real)
		}
	})

	t.Run("relative paths are resolved against the working directory", func(t *testing.T) {
		// The UI can hand back a path as the user typed it; compose is run
		// from a different directory, so it has to be made absolute here.
		t.Chdir(dir)
		got := existingFiles([]string{"compose.yaml"})
		if len(got) != 1 || !filepath.IsAbs(got[0]) || filepath.Base(got[0]) != "compose.yaml" {
			t.Errorf("existingFiles([compose.yaml]) = %q, want one absolute path", got)
		}
	})
}

func TestComposeArgs(t *testing.T) {
	tests := []struct {
		name    string
		files   []string
		project string
		want    []string
	}{
		{name: "bare", want: []string{"compose"}},
		{
			name:  "each file gets its own -f",
			files: []string{"/a/compose.yaml", "/a/override.yaml"},
			want:  []string{"compose", "-f", "/a/compose.yaml", "-f", "/a/override.yaml"},
		},
		{name: "blank files are skipped", files: []string{"", "/a/compose.yaml"}, want: []string{"compose", "-f", "/a/compose.yaml"}},
		{name: "project name", project: "web", want: []string{"compose", "-p", "web"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := composeArgs(tc.files, tc.project); !slices.Equal(got, tc.want) {
				t.Errorf("composeArgs(%q, %q) = %q, want %q", tc.files, tc.project, got, tc.want)
			}
		})
	}
}

func TestResolveComposeConfigFilesWin(t *testing.T) {
	dir := t.TempDir()
	file := writeFile(t, filepath.Join(dir, "compose.yaml"))

	gotDir, files, cleanup, err := resolveCompose(UpRequest{ConfigFiles: []string{file}, Path: "/nonexistent"})
	if err != nil {
		t.Fatalf("resolveCompose: %v", err)
	}
	if cleanup != nil {
		t.Error("no temp file was written, so there is nothing to clean up")
	}
	if gotDir != dir || !slices.Equal(files, []string{file}) {
		t.Errorf("resolveCompose = (%q, %q), want (%q, [%q])", gotDir, files, dir, file)
	}
}

func TestResolveComposePicksTheCanonicalFileName(t *testing.T) {
	// composeFileNames is ordered, and compose.yaml is the name the Compose
	// spec prefers — a directory holding both must resolve to it.
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "docker-compose.yml"))
	preferred := writeFile(t, filepath.Join(dir, "compose.yaml"))

	gotDir, files, _, err := resolveCompose(UpRequest{Path: dir})
	if err != nil {
		t.Fatalf("resolveCompose: %v", err)
	}
	if gotDir != dir || !slices.Equal(files, []string{preferred}) {
		t.Errorf("resolveCompose = (%q, %q), want (%q, [%q])", gotDir, files, dir, preferred)
	}
}

func TestResolveComposeAcceptsAFilePath(t *testing.T) {
	dir := t.TempDir()
	file := writeFile(t, filepath.Join(dir, "stack.yaml"))

	gotDir, files, _, err := resolveCompose(UpRequest{Path: file})
	if err != nil {
		t.Fatalf("resolveCompose: %v", err)
	}
	if gotDir != dir || !slices.Equal(files, []string{file}) {
		t.Errorf("resolveCompose = (%q, %q), want (%q, [%q])", gotDir, files, dir, file)
	}
}

func TestResolveComposeWritesInlineYAMLAndCleansUp(t *testing.T) {
	dir, files, cleanup, err := resolveCompose(UpRequest{YAML: "services:\n  web:\n    image: nginx\n"})
	if err != nil {
		t.Fatalf("resolveCompose: %v", err)
	}
	if cleanup == nil {
		t.Fatal("inline YAML writes a temp tree, so a cleanup func is required")
	}
	if len(files) != 1 || filepath.Base(files[0]) != "compose.yaml" {
		t.Fatalf("files = %q, want one compose.yaml", files)
	}
	body, err := os.ReadFile(files[0])
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), "image: nginx") {
		t.Errorf("temp compose file = %q, want the request's YAML", body)
	}

	cleanup()
	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Errorf("cleanup left %q behind (err=%v)", dir, err)
	}
}

func TestResolveComposeErrors(t *testing.T) {
	t.Run("nothing to run", func(t *testing.T) {
		if _, _, _, err := resolveCompose(UpRequest{}); err == nil {
			t.Error("resolveCompose with no path or yaml should fail")
		}
	})

	t.Run("directory without a compose file", func(t *testing.T) {
		_, _, _, err := resolveCompose(UpRequest{Path: t.TempDir()})
		if err == nil || !strings.Contains(err.Error(), "no compose file") {
			t.Errorf("err = %v, want a 'no compose file' error", err)
		}
	})
}

func TestResolveComposeOptionalFile(t *testing.T) {
	t.Run("project name alone is enough", func(t *testing.T) {
		// down/restart/ps can address a project docker already knows, with no
		// file on disk to point at.
		dir, files, cleanup, err := resolveComposeOptionalFile(UpRequest{ProjectName: "web"})
		if err != nil {
			t.Fatalf("resolveComposeOptionalFile: %v", err)
		}
		if dir != "" || files != nil || cleanup != nil {
			t.Errorf("= (%q, %q, cleanup!=nil:%v), want all empty", dir, files, cleanup != nil)
		}
	})

	t.Run("nothing at all fails", func(t *testing.T) {
		if _, _, _, err := resolveComposeOptionalFile(UpRequest{}); err == nil {
			t.Error("expected an error when no project, path, or yaml is given")
		}
	})

	t.Run("a path still resolves to files", func(t *testing.T) {
		dir := t.TempDir()
		file := writeFile(t, filepath.Join(dir, "compose.yml"))
		gotDir, files, _, err := resolveComposeOptionalFile(UpRequest{Path: dir, ProjectName: "web"})
		if err != nil {
			t.Fatalf("resolveComposeOptionalFile: %v", err)
		}
		if gotDir != dir || !slices.Equal(files, []string{file}) {
			t.Errorf("= (%q, %q), want (%q, [%q])", gotDir, files, dir, file)
		}
	})
}

func TestDiscover(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "compose.yaml"))
	writeFile(t, filepath.Join(root, "api", "docker-compose.yml"))
	writeFile(t, filepath.Join(root, "deep", "one", "two", "compose.yaml"))
	writeFile(t, filepath.Join(root, "node_modules", "pkg", "compose.yaml"))
	writeFile(t, filepath.Join(root, ".git", "compose.yaml"))
	writeFile(t, filepath.Join(root, "vendor", "compose.yaml"))
	writeFile(t, filepath.Join(root, "notes.yaml"))

	byPath := func(projects []Project) map[string]Project {
		m := map[string]Project{}
		for _, p := range projects {
			rel, err := filepath.Rel(root, p.Path)
			if err != nil {
				t.Fatal(err)
			}
			m[filepath.ToSlash(rel)] = p
		}
		return m
	}

	t.Run("finds compose files and skips vendored trees", func(t *testing.T) {
		found := byPath(mustDiscover(t, DiscoverRequest{Roots: []string{root}}))
		for _, want := range []string{"compose.yaml", "api/docker-compose.yml", "deep/one/two/compose.yaml"} {
			if _, ok := found[want]; !ok {
				t.Errorf("Discover missed %s (got %v)", want, keys(found))
			}
		}
		for _, skipped := range []string{"node_modules/pkg/compose.yaml", ".git/compose.yaml", "vendor/compose.yaml"} {
			if _, ok := found[skipped]; ok {
				t.Errorf("Discover should not descend into %s", skipped)
			}
		}
		if _, ok := found["notes.yaml"]; ok {
			t.Error("Discover matched a yaml file that is not a compose file name")
		}
	})

	t.Run("project name is the containing directory", func(t *testing.T) {
		found := byPath(mustDiscover(t, DiscoverRequest{Roots: []string{root}}))
		if got := found["api/docker-compose.yml"]; got.Name != "api" || got.Source != "scan" || got.Status != "discovered" {
			t.Errorf("project = %+v, want name=api source=scan status=discovered", got)
		}
	})

	t.Run("one project per directory", func(t *testing.T) {
		dir := t.TempDir()
		writeFile(t, filepath.Join(dir, "compose.yaml"))
		writeFile(t, filepath.Join(dir, "docker-compose.yml"))
		projects := mustDiscover(t, DiscoverRequest{Roots: []string{dir}})
		if len(projects) != 1 {
			t.Fatalf("Discover returned %d projects for one directory, want 1", len(projects))
		}
		if filepath.Base(projects[0].Path) != "compose.yaml" {
			t.Errorf("Path = %q, want the canonical compose.yaml", projects[0].Path)
		}
	})

	t.Run("maxDepth bounds the walk", func(t *testing.T) {
		found := byPath(mustDiscover(t, DiscoverRequest{Roots: []string{root}, MaxDepth: 1}))
		if _, ok := found["api/docker-compose.yml"]; !ok {
			t.Error("depth 1 should still reach a direct subdirectory")
		}
		if _, ok := found["deep/one/two/compose.yaml"]; ok {
			t.Error("depth 1 should not reach a three-deep file")
		}
	})

	t.Run("maxDepth is clamped so a scan cannot run away", func(t *testing.T) {
		deep := t.TempDir()
		dir := deep
		for _, name := range []string{"d1", "d2", "d3", "d4", "d5", "d6", "d7"} {
			dir = filepath.Join(dir, name)
			writeFile(t, filepath.Join(dir, "compose.yaml"))
		}
		projects := mustDiscover(t, DiscoverRequest{Roots: []string{deep}, MaxDepth: 100})
		// Depths 1..6 are walked; the seventh level is beyond the cap.
		if len(projects) != 6 {
			t.Errorf("Discover with MaxDepth=100 found %d projects, want 6 (capped at depth 6)", len(projects))
		}
	})

	t.Run("unusable roots are ignored", func(t *testing.T) {
		file := writeFile(t, filepath.Join(t.TempDir(), "compose.yaml"))
		projects := mustDiscover(t, DiscoverRequest{Roots: []string{"", "   ", filepath.Join(root, "does-not-exist"), file}})
		if len(projects) != 0 {
			t.Errorf("Discover = %+v, want nothing for blank, missing, and non-directory roots", projects)
		}
	})
}

func mustDiscover(t *testing.T, req DiscoverRequest) []Project {
	t.Helper()
	projects, err := (&Service{}).Discover(t.Context(), req)
	if err != nil {
		t.Fatalf("Discover: %v", err)
	}
	return projects
}

func keys(m map[string]Project) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	slices.Sort(out)
	return out
}

func TestParseComposeLs(t *testing.T) {
	dir := t.TempDir()
	file := writeFile(t, filepath.Join(dir, "compose.yaml"))

	t.Run("empty output", func(t *testing.T) {
		for _, out := range []string{"", "   ", "null"} {
			projects, err := parseComposeLs(out)
			if err != nil {
				t.Fatalf("parseComposeLs(%q): %v", out, err)
			}
			if projects == nil || len(projects) != 0 {
				t.Errorf("parseComposeLs(%q) = %v, want an empty, non-nil slice", out, projects)
			}
		}
	})

	t.Run("json array", func(t *testing.T) {
		out := `[{"Name":"web","Status":"running(2)","ConfigFiles":"` + file + `"},
		         {"Name":"idle","Status":"exited(1)","ConfigFiles":""}]`
		projects, err := parseComposeLs(out)
		if err != nil {
			t.Fatalf("parseComposeLs: %v", err)
		}
		if len(projects) != 2 {
			t.Fatalf("got %d projects, want 2", len(projects))
		}
		if projects[0].Name != "web" || projects[0].Path != file || projects[0].Source != "engine" {
			t.Errorf("first project = %+v, want web at %q from the engine", projects[0], file)
		}
		if !projects[0].Running {
			t.Error(`status "running(2)" should mark the project running`)
		}
		if projects[1].Running || projects[1].Path != "" {
			t.Errorf("second project = %+v, want not running with no path", projects[1])
		}
	})

	t.Run("ndjson fallback", func(t *testing.T) {
		// Older docker versions emit one object per line rather than an array.
		out := `{"Name":"a","Status":"running(1)","ConfigFiles":""}` + "\n" +
			`{"Name":"b","Status":"exited(0)","ConfigFiles":""}` + "\n"
		projects, err := parseComposeLs(out)
		if err != nil {
			t.Fatalf("parseComposeLs: %v", err)
		}
		if len(projects) != 2 || projects[0].Name != "a" || projects[1].Name != "b" {
			t.Errorf("parseComposeLs = %+v, want projects a and b", projects)
		}
	})

	t.Run("config files that no longer exist are dropped", func(t *testing.T) {
		// A project can outlive the checkout it was started from.
		projects, err := parseComposeLs(`[{"Name":"web","ConfigFiles":"` + filepath.Join(dir, "gone.yaml") + `"}]`)
		if err != nil {
			t.Fatalf("parseComposeLs: %v", err)
		}
		if len(projects) != 1 || projects[0].Path != "" || len(projects[0].ConfigFiles) != 0 {
			t.Errorf("parseComposeLs = %+v, want the project with no files", projects)
		}
	})

	t.Run("unparseable output", func(t *testing.T) {
		_, err := parseComposeLs("not json at all")
		if err == nil || !strings.Contains(err.Error(), "parse compose ls") {
			t.Errorf("err = %v, want a parse compose ls error", err)
		}
	})
}

func TestParseComposePs(t *testing.T) {
	t.Run("empty output", func(t *testing.T) {
		for _, out := range []string{"", "null"} {
			services, err := parseComposePs(out)
			if err != nil {
				t.Fatalf("parseComposePs(%q): %v", out, err)
			}
			if len(services) != 0 {
				t.Errorf("parseComposePs(%q) = %+v, want none", out, services)
			}
		}
	})

	t.Run("json array", func(t *testing.T) {
		out := `[{"Service":"web","State":"running","Status":"Up 2 hours","Image":"nginx","Project":"site"}]`
		services, err := parseComposePs(out)
		if err != nil {
			t.Fatalf("parseComposePs: %v", err)
		}
		want := ServiceInfo{Name: "web", State: "running", Status: "Up 2 hours", Image: "nginx", Project: "site"}
		if len(services) != 1 || services[0] != want {
			t.Errorf("parseComposePs = %+v, want [%+v]", services, want)
		}
	})

	t.Run("ndjson", func(t *testing.T) {
		out := `{"Service":"web","State":"running"}` + "\n" + `{"Service":"db","State":"exited"}` + "\n"
		services, err := parseComposePs(out)
		if err != nil {
			t.Fatalf("parseComposePs: %v", err)
		}
		if len(services) != 2 || services[0].Name != "web" || services[1].Name != "db" {
			t.Errorf("parseComposePs = %+v, want web and db", services)
		}
	})

	t.Run("falls back to the container name", func(t *testing.T) {
		// Compose v2 reports Service; some versions only carry Name.
		services, err := parseComposePs(`[{"Name":"site-web-1","State":"running"}]`)
		if err != nil {
			t.Fatalf("parseComposePs: %v", err)
		}
		if len(services) != 1 || services[0].Name != "site-web-1" {
			t.Errorf("parseComposePs = %+v, want the container name as the service name", services)
		}
	})

	t.Run("unparseable output", func(t *testing.T) {
		if _, err := parseComposePs(`[{"Service":`); err == nil {
			t.Error("expected an error for a truncated array")
		}
		if _, err := parseComposePs("plain text\n"); err == nil {
			t.Error("expected an error for non-JSON lines")
		}
	})
}
