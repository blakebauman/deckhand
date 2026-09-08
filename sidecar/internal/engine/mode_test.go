package engine

import (
	"os"
	"path/filepath"
	"testing"
)

func tempStorePath(t *testing.T) string {
	t.Helper()
	return filepath.Join(t.TempDir(), "nested", "engine.json")
}

func TestNewStoreDefaultsWhenNoFileExists(t *testing.T) {
	cfg := NewStore(tempStorePath(t)).Get()

	if cfg.Mode != ModeAttach {
		t.Errorf("Mode = %q, want %q — attach is the only mode that works today", cfg.Mode, ModeAttach)
	}
	if cfg.EmbedAvailable {
		t.Error("EmbedAvailable should be false; the embed runtime is a scaffold")
	}
	if cfg.EmbedStatus != "not_implemented" {
		t.Errorf("EmbedStatus = %q, want not_implemented", cfg.EmbedStatus)
	}
	if cfg.CPU != 4 || cfg.MemoryMiB != 4096 || cfg.DiskGiB != 64 || !cfg.ResourceSaver {
		t.Errorf("resource defaults = %+v, want cpu=4 mem=4096 disk=64 saver=true", cfg)
	}
}

func TestSetModeEmbedRecordsTheRequestButNotAvailability(t *testing.T) {
	s := NewStore(tempStorePath(t))
	if err := s.SetMode(ModeEmbed); err != nil {
		t.Fatalf("SetMode: %v", err)
	}

	cfg := s.Get()
	if cfg.Mode != ModeEmbed {
		t.Errorf("Mode = %q, want %q", cfg.Mode, ModeEmbed)
	}
	if cfg.EmbedAvailable {
		t.Error("selecting embed must not claim the embed runtime is available")
	}
	if cfg.EmbedStatus == "" || cfg.EmbedStatus == "not_implemented" {
		t.Errorf("EmbedStatus = %q, want an explanation of the scaffold state", cfg.EmbedStatus)
	}
}

func TestSetModeRejectsUnknownModes(t *testing.T) {
	// The mode arrives from PUT /api/engine, so anything off the two-value
	// enum falls back to attach rather than persisting a mode nothing honours.
	for _, mode := range []Mode{"", "docker", "EMBED"} {
		t.Run(string(mode), func(t *testing.T) {
			s := NewStore(tempStorePath(t))
			if err := s.SetMode(mode); err != nil {
				t.Fatalf("SetMode(%q): %v", mode, err)
			}
			if got := s.Get().Mode; got != ModeAttach {
				t.Errorf("SetMode(%q) left Mode = %q, want %q", mode, got, ModeAttach)
			}
		})
	}
}

func TestSetModePersistsAcrossStores(t *testing.T) {
	path := tempStorePath(t)
	if err := NewStore(path).SetMode(ModeEmbed); err != nil {
		t.Fatalf("SetMode: %v", err)
	}

	// A relaunch reads the file back rather than resetting to attach.
	if got := NewStore(path).Get().Mode; got != ModeEmbed {
		t.Errorf("reloaded Mode = %q, want %q", got, ModeEmbed)
	}
}

func TestUpdatePersistsMutations(t *testing.T) {
	path := tempStorePath(t)
	s := NewStore(path)
	if err := s.Update(func(c *Config) {
		c.CPU = 8
		c.VirtioFSShares = []string{"/srv/work"}
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}

	cfg := NewStore(path).Get()
	if cfg.CPU != 8 {
		t.Errorf("reloaded CPU = %d, want 8", cfg.CPU)
	}
	if len(cfg.VirtioFSShares) != 1 || cfg.VirtioFSShares[0] != "/srv/work" {
		t.Errorf("reloaded VirtioFSShares = %v, want [/srv/work]", cfg.VirtioFSShares)
	}
}

func TestLoadFillsInAMissingMode(t *testing.T) {
	path := tempStorePath(t)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"cpu":2}`), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg := NewStore(path).Get()
	if cfg.Mode != ModeAttach {
		t.Errorf("Mode = %q, want %q for a file that omits it", cfg.Mode, ModeAttach)
	}
	if cfg.CPU != 2 {
		t.Errorf("CPU = %d, want the stored 2", cfg.CPU)
	}
}

func TestCorruptFileFallsBackToDefaults(t *testing.T) {
	// A half-written engine.json must not leave the sidecar with a zero-value
	// config (mode "", cpu 0) that the UI cannot render.
	path := tempStorePath(t)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"mode":`), 0o644); err != nil {
		t.Fatal(err)
	}

	cfg := NewStore(path).Get()
	if cfg.Mode != ModeAttach || cfg.CPU != 4 {
		t.Errorf("config = %+v, want the defaults", cfg)
	}
}
