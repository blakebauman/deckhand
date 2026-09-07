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

// Documents two known limitations of the field-splitting approach rather than
// asserting they are correct: `ls -la` output is ambiguous once a name contains
// a space or the entry is a symlink. Both currently produce a wrong Name.
// If parseLSListing is ever hardened, these expectations should flip.
func TestParseLSListingKnownLimitations(t *testing.T) {
	t.Run("filename containing spaces is truncated", func(t *testing.T) {
		out := "-rw-r--r--    1 root     root            13 Jan  1 00:00 my file.txt\n"
		got := parseLSListing(out, "")
		if len(got) != 1 {
			t.Fatalf("got %d entries, want 1", len(got))
		}
		if got[0].Name != "file.txt" {
			t.Errorf("Name = %q; expected the current (wrong) %q — if this now "+
				"returns \"my file.txt\", parsing was fixed and this test should assert that",
				got[0].Name, "file.txt")
		}
	})

	t.Run("symlink reports its target as the name", func(t *testing.T) {
		out := "lrwxrwxrwx    1 root     root             4 Jan  1 00:00 link -> /target\n"
		got := parseLSListing(out, "")
		if len(got) != 1 {
			t.Fatalf("got %d entries, want 1", len(got))
		}
		if got[0].Name != "/target" {
			t.Errorf("Name = %q; expected the current (wrong) %q — if this now "+
				"returns \"link\", parsing was fixed and this test should assert that",
				got[0].Name, "/target")
		}
	})
}
