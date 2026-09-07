package k8s

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// The whole point of SecretSummary is that values never leave the sidecar.
// Marshal the result and search it, so this fails if anyone ever adds a field
// that carries data — a test that only checked Keys would not notice.
func TestSummarizeSecretNeverExposesValues(t *testing.T) {
	secret := corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "prod"},
		Type:       corev1.SecretTypeOpaque,
		Data: map[string][]byte{
			"password":     []byte("hunter2-should-never-appear"),
			"api-key":      []byte("sk-live-topsecret"),
			"tls.key":      []byte("-----BEGIN PRIVATE KEY-----"),
			"empty":        []byte(""),
			"binary-value": {0x00, 0x01, 0x02},
		},
	}

	encoded, err := json.Marshal(summarizeSecret(secret))
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	serialized := string(encoded)

	for _, leak := range []string{
		"hunter2-should-never-appear",
		"sk-live-topsecret",
		"BEGIN PRIVATE KEY",
	} {
		if strings.Contains(serialized, leak) {
			t.Errorf("secret value %q leaked into the summary: %s", leak, serialized)
		}
	}

	// Base64 is how Secret data is transported, so check that shape too.
	if strings.Contains(serialized, "aHVudGVyMg") {
		t.Errorf("base64-encoded secret value leaked: %s", serialized)
	}
}

func TestSummarizeSecretKeysAreSortedAndComplete(t *testing.T) {
	secret := corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{Name: "db", Namespace: "prod"},
		Data: map[string][]byte{
			"zebra": []byte("v"), "alpha": []byte("v"), "middle": []byte("v"),
			"Beta": []byte("v"), "0-numeric": []byte("v"),
		},
	}

	// Map iteration order is random, so repeat: an unsorted implementation
	// passes a single run by luck fairly often.
	want := []string{"0-numeric", "Beta", "alpha", "middle", "zebra"}
	for i := 0; i < 50; i++ {
		got := summarizeSecret(secret).Keys
		if len(got) != len(want) {
			t.Fatalf("Keys = %v, want %v", got, want)
		}
		for j := range want {
			if got[j] != want[j] {
				t.Fatalf("run %d: Keys = %v, want %v (sorted)", i, got, want)
			}
		}
	}
}

func TestSummarizeSecretMetadata(t *testing.T) {
	created := time.Date(2024, 3, 1, 12, 30, 0, 0, time.UTC)
	secret := corev1.Secret{
		ObjectMeta: metav1.ObjectMeta{
			Name:              "tls",
			Namespace:         "web",
			Labels:            map[string]string{"app": "nginx"},
			CreationTimestamp: metav1.NewTime(created),
		},
		Type: corev1.SecretTypeTLS,
		Data: map[string][]byte{"tls.crt": []byte("x")},
	}

	got := summarizeSecret(secret)
	if got.Name != "tls" || got.Namespace != "web" {
		t.Errorf("name/namespace = %q/%q, want tls/web", got.Name, got.Namespace)
	}
	if got.Type != string(corev1.SecretTypeTLS) {
		t.Errorf("Type = %q, want %q", got.Type, corev1.SecretTypeTLS)
	}
	if got.Labels["app"] != "nginx" {
		t.Errorf("Labels = %v, want app=nginx", got.Labels)
	}
	if got.Created != created.Format(time.RFC3339) {
		t.Errorf("Created = %q, want %q", got.Created, created.Format(time.RFC3339))
	}
}

func TestSummarizeSecretEmptyCases(t *testing.T) {
	// A Secret with no data must yield an empty, non-nil key list so the UI
	// renders "no keys" rather than choking on a null.
	got := summarizeSecret(corev1.Secret{ObjectMeta: metav1.ObjectMeta{Name: "empty"}})
	if got.Keys == nil {
		t.Error("Keys = nil, want an empty slice")
	}
	if len(got.Keys) != 0 {
		t.Errorf("Keys = %v, want empty", got.Keys)
	}
	if got.Created != "" {
		t.Errorf("Created = %q, want empty for a zero timestamp", got.Created)
	}
}
