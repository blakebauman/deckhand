package domains

import "testing"

// matchDomainLabels decides which container a *.deckhand.local request is
// proxied to. Callers pass an already-lowercased host (resolveContainer does
// the lowering), so these cases use lowercase hosts.
func TestMatchDomainLabels(t *testing.T) {
	tests := []struct {
		name   string
		labels map[string]string
		host   string
		want   bool
	}{
		{name: "nil labels", labels: nil, host: "api", want: false},
		{name: "empty labels", labels: map[string]string{}, host: "api", want: false},
		{name: "unrelated label", labels: map[string]string{"app": "api"}, host: "api", want: false},

		{
			name:   "bare name matches",
			labels: map[string]string{"dev.deckhand.domains": "api"},
			host:   "api", want: true,
		},
		{
			name:   "deckhand.local suffix is trimmed before comparing",
			labels: map[string]string{"dev.deckhand.domains": "api.deckhand.local"},
			host:   "api", want: true,
		},
		{
			name:   "plain .local suffix is trimmed",
			labels: map[string]string{"dev.deckhand.domains": "api.local"},
			host:   "api", want: true,
		},
		{
			name:   "orbstack key is honoured",
			labels: map[string]string{"dev.orbstack.domains": "api.orb.local"},
			host:   "api", want: true,
		},
		{
			name:   "label case is normalized",
			labels: map[string]string{"dev.deckhand.domains": "API.Deckhand.Local"},
			host:   "api", want: true,
		},

		{
			name:   "comma list matches any entry",
			labels: map[string]string{"dev.deckhand.domains": "web,api,admin"},
			host:   "api", want: true,
		},
		{
			name:   "comma list tolerates spacing",
			labels: map[string]string{"dev.deckhand.domains": " web , api , admin "},
			host:   "api", want: true,
		},

		// A label matches its own subdomains, but must not match a host that
		// merely starts with the same characters.
		{
			name:   "subdomain of a labelled host matches",
			labels: map[string]string{"dev.deckhand.domains": "api"},
			host:   "v2.api", want: false,
		},
		{
			name:   "host under the labelled name matches",
			labels: map[string]string{"dev.deckhand.domains": "api"},
			host:   "api.v2", want: true,
		},
		{
			name:   "prefix without a dot boundary does not match",
			labels: map[string]string{"dev.deckhand.domains": "api"},
			host:   "apifoo", want: false,
		},
		{
			name:   "unrelated host",
			labels: map[string]string{"dev.deckhand.domains": "api"},
			host:   "web", want: false,
		},

		{
			name:   "empty label value never matches",
			labels: map[string]string{"dev.deckhand.domains": ""},
			host:   "api", want: false,
		},
		{
			name:   "commas only never match",
			labels: map[string]string{"dev.deckhand.domains": ",,,"},
			host:   "api", want: false,
		},
		{
			name:   "a suffix-only label must not match everything",
			labels: map[string]string{"dev.deckhand.domains": ".local"},
			host:   "api", want: false,
		},
		{
			name:   "empty host is not matched by an empty entry",
			labels: map[string]string{"dev.deckhand.domains": ""},
			host:   "", want: false,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := matchDomainLabels(tc.labels, tc.host); got != tc.want {
				t.Errorf("matchDomainLabels(%v, %q) = %v, want %v", tc.labels, tc.host, got, tc.want)
			}
		})
	}
}
