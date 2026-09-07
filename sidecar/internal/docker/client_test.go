package docker

import "testing"

func TestShortID(t *testing.T) {
	const full = "0123456789abcdef0123456789abcdef"
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "full length id truncates to 12", in: full, want: "0123456789ab"},
		{name: "exactly 12 is unchanged", in: "0123456789ab", want: "0123456789ab"},
		{name: "13 truncates", in: "0123456789abc", want: "0123456789ab"},
		{name: "shorter is unchanged", in: "abc", want: "abc"},
		{name: "empty is unchanged", in: "", want: ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := ShortID(tc.in); got != tc.want {
				t.Errorf("ShortID(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}

func TestContainerName(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want string
	}{
		// The engine returns names with a leading slash.
		{name: "leading slash stripped", in: []string{"/web"}, want: "web"},
		{name: "first name wins", in: []string{"/web", "/alias"}, want: "web"},
		{name: "no names", in: nil, want: ""},
		{name: "empty slice", in: []string{}, want: ""},
		{name: "name without a slash", in: []string{"web"}, want: "web"},
		{name: "only the leading slash is removed", in: []string{"/parent/child"}, want: "parent/child"},
		{name: "empty first name", in: []string{""}, want: ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := ContainerName(tc.in); got != tc.want {
				t.Errorf("ContainerName(%q) = %q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
