package docker

import "testing"

// cleanVolPath sanitizes a user-supplied path before it is interpolated into a
// shell command inside a helper container, so traversal must not survive it.
func TestCleanVolPathContainsTraversal(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "plain relative path", in: "data/logs", want: "data/logs"},
		{name: "leading slash is stripped", in: "/data/logs", want: "data/logs"},
		{name: "trailing slash is dropped", in: "data/logs/", want: "data/logs"},
		{name: "empty stays empty", in: "", want: ""},
		{name: "root becomes empty", in: "/", want: ""},
		{name: "dot becomes empty", in: ".", want: ""},
		{name: "whitespace is trimmed", in: "  data  ", want: "data"},
		{name: "inner dot segments collapse", in: "data/./logs", want: "data/logs"},

		// The security-relevant cases: none may escape the volume root.
		{name: "parent traversal", in: "../etc/passwd", want: "etc/passwd"},
		{name: "repeated traversal", in: "../../../../etc/shadow", want: "etc/shadow"},
		{name: "absolute traversal", in: "/../etc/passwd", want: "etc/passwd"},
		{name: "traversal after a segment", in: "data/../../etc/passwd", want: "etc/passwd"},
		{name: "traversal back to root", in: "a/../../b", want: "b"},
		{name: "bare parent becomes empty", in: "..", want: ""},
		{name: "parent with slash becomes empty", in: "../", want: ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := cleanVolPath(tc.in)
			if got != tc.want {
				t.Errorf("cleanVolPath(%q) = %q, want %q", tc.in, got, tc.want)
			}
			// Whatever the input, the result must never be absolute or start
			// with a parent reference.
			if len(got) > 0 && got[0] == '/' {
				t.Errorf("cleanVolPath(%q) = %q, which is absolute", tc.in, got)
			}
			if got == ".." || (len(got) >= 3 && got[:3] == "../") {
				t.Errorf("cleanVolPath(%q) = %q, which escapes the root", tc.in, got)
			}
		})
	}
}

func TestParseLSListing(t *testing.T) {
	// busybox `ls -la`, which is what the helper container runs.
	out := `total 16
drwxr-xr-x    3 root     root          4096 Jan  1 00:00 .
drwxr-xr-x    4 root     root          4096 Jan  1 00:00 ..
-rw-r--r--    1 root     root            13 Jan  1 00:00 hello.txt
drwxr-xr-x    2 root     root          4096 Jan  1 00:00 nested
-rw-r--r--    1 root     root       1048576 Jan  1 00:00 big.bin
`
	got := parseLSListing(out, "")
	if len(got) != 3 {
		t.Fatalf("got %d entries, want 3 (. and .. excluded): %+v", len(got), got)
	}

	if got[0].Name != "hello.txt" || got[0].Dir || got[0].Size != 13 {
		t.Errorf("hello.txt = %+v, want name=hello.txt dir=false size=13", got[0])
	}
	if got[1].Name != "nested" || !got[1].Dir {
		t.Errorf("nested = %+v, want dir=true", got[1])
	}
	if got[2].Size != 1048576 {
		t.Errorf("big.bin size = %d, want 1048576", got[2].Size)
	}
	if got[0].Mode != "-rw-r--r--" {
		t.Errorf("Mode = %q, want the raw mode string", got[0].Mode)
	}
}

func TestParseLSListingJoinsBasePath(t *testing.T) {
	out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 hello.txt\n"

	if got := parseLSListing(out, ""); got[0].Path != "hello.txt" {
		t.Errorf("Path with empty base = %q, want hello.txt", got[0].Path)
	}
	if got := parseLSListing(out, "data/logs"); got[0].Path != "data/logs/hello.txt" {
		t.Errorf("Path with base = %q, want data/logs/hello.txt", got[0].Path)
	}
}

func TestParseLSListingIgnoresNoise(t *testing.T) {
	tests := []struct {
		name string
		out  string
	}{
		{name: "empty output", out: ""},
		{name: "only a total line", out: "total 0\n"},
		{name: "only dot entries", out: "drwxr-xr-x 2 root root 4096 Jan 1 00:00 .\ndrwxr-xr-x 2 root root 4096 Jan 1 00:00 ..\n"},
		{name: "blank lines", out: "\n\n   \n"},
		{name: "short malformed line", out: "garbage\n"},
		{name: "seven fields is too few", out: "-rw-r--r-- 1 root root 13 Jan 1\n"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := parseLSListing(tc.out, ""); len(got) != 0 {
				t.Errorf("parseLSListing(%q) = %+v, want no entries", tc.out, got)
			}
		})
	}
}

// `ls -la` output is ambiguous once a name contains a space or the entry is a
// symlink; both used to be mis-parsed by splitting on whitespace and taking
// the last field.
func TestParseLSListingNamesWithSpacesAndSymlinks(t *testing.T) {
	t.Run("filename containing spaces is kept whole", func(t *testing.T) {
		out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 my file.txt\n"
		got := parseLSListing(out, "")
		if len(got) != 1 {
			t.Fatalf("got %d entries, want 1", len(got))
		}
		if got[0].Name != "my file.txt" {
			t.Errorf("Name = %q, want %q", got[0].Name, "my file.txt")
		}
	})

	t.Run("internal spacing is preserved exactly", func(t *testing.T) {
		out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 two  spaces.txt\n"
		got := parseLSListing(out, "")
		if got[0].Name != "two  spaces.txt" {
			t.Errorf("Name = %q, want the original double space preserved", got[0].Name)
		}
	})

	t.Run("spaced name joins the base path", func(t *testing.T) {
		out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 my file.txt\n"
		got := parseLSListing(out, "data")
		if got[0].Path != "data/my file.txt" {
			t.Errorf("Path = %q, want data/my file.txt", got[0].Path)
		}
	})

	t.Run("symlink reports its own name and target", func(t *testing.T) {
		out := "lrwxrwxrwx    1 root     root             4 Jan  1 00:00 link -> /target\n"
		got := parseLSListing(out, "")
		if len(got) != 1 {
			t.Fatalf("got %d entries, want 1", len(got))
		}
		if got[0].Name != "link" {
			t.Errorf("Name = %q, want link", got[0].Name)
		}
		if got[0].Link != "/target" {
			t.Errorf("Link = %q, want /target", got[0].Link)
		}
		if got[0].Dir {
			t.Error("Dir = true for a symlink, want false")
		}
	})

	t.Run("symlink with spaces on both sides", func(t *testing.T) {
		out := "lrwxrwxrwx    1 root     root             4 Jan  1 00:00 my link -> /some path/target\n"
		got := parseLSListing(out, "")
		if got[0].Name != "my link" || got[0].Link != "/some path/target" {
			t.Errorf("got name=%q link=%q, want %q / %q",
				got[0].Name, got[0].Link, "my link", "/some path/target")
		}
	})

	t.Run("an arrow in a regular filename is not treated as a link", func(t *testing.T) {
		// Only entries whose mode marks them a symlink are split on " -> ".
		out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 a -> b.txt\n"
		got := parseLSListing(out, "")
		if got[0].Name != "a -> b.txt" {
			t.Errorf("Name = %q, want the arrow kept in a regular filename", got[0].Name)
		}
		if got[0].Link != "" {
			t.Errorf("Link = %q, want empty for a non-symlink", got[0].Link)
		}
	})

	t.Run("non-symlinks carry no link target", func(t *testing.T) {
		out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 plain.txt\n"
		if got := parseLSListing(out, ""); got[0].Link != "" {
			t.Errorf("Link = %q, want empty", got[0].Link)
		}
	})
}

func TestSplitLSColumns(t *testing.T) {
	tests := []struct {
		name     string
		line     string
		n        int
		wantCols int
		wantRest string
	}{
		{name: "standard listing", line: "-rw-r--r-- 1 root root 13 Jan 1 00:00 f.txt", n: 8, wantCols: 8, wantRest: "f.txt"},
		{name: "rest keeps inner spacing", line: "-rw-r--r-- 1 root root 13 Jan 1 00:00 a  b", n: 8, wantCols: 8, wantRest: "a  b"},
		{name: "padded columns", line: "-rw-r--r--    1 root     root   13 Jan  1 00:00 f", n: 8, wantCols: 8, wantRest: "f"},
		{name: "too few columns", line: "-rw-r--r-- 1 root", n: 8, wantCols: 3, wantRest: ""},
		{name: "exactly n columns leaves no rest", line: "a b c d e f g h", n: 8, wantCols: 8, wantRest: ""},
		{name: "empty line", line: "", n: 8, wantCols: 0, wantRest: ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cols, rest := splitLSColumns(tc.line, tc.n)
			if len(cols) != tc.wantCols {
				t.Errorf("columns = %d (%q), want %d", len(cols), cols, tc.wantCols)
			}
			if rest != tc.wantRest {
				t.Errorf("rest = %q, want %q", rest, tc.wantRest)
			}
		})
	}
}
