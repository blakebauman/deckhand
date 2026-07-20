package engine

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// Mode is attach (host Docker) or embed (Deckhand-managed VM — scaffold).
type Mode string

const (
	ModeAttach Mode = "attach"
	ModeEmbed  Mode = "embed"
)

type Config struct {
	Mode           Mode     `json:"mode"`
	EmbedAvailable bool     `json:"embedAvailable"`
	EmbedStatus    string   `json:"embedStatus,omitempty"`
	VirtioFSShares []string `json:"virtiofsShares,omitempty"`
	CPU            int      `json:"cpu,omitempty"`
	MemoryMiB      int      `json:"memoryMiB,omitempty"`
	DiskGiB        int      `json:"diskGiB,omitempty"`
	ResourceSaver  bool     `json:"resourceSaver,omitempty"`
}

type Store struct {
	mu   sync.Mutex
	path string
	cfg  Config
}

func DefaultPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".deckhand", "engine.json")
}

func NewStore(path string) *Store {
	if path == "" {
		path = DefaultPath()
	}
	s := &Store{path: path, cfg: Config{
		Mode:           ModeAttach,
		EmbedAvailable: false,
		EmbedStatus:    "not_implemented",
		VirtioFSShares: defaultShares(),
		CPU:            4,
		MemoryMiB:      4096,
		DiskGiB:        64,
		ResourceSaver:  true,
	}}
	_ = s.load()
	return s
}

func defaultShares() []string {
	home, _ := os.UserHomeDir()
	if home == "" {
		return nil
	}
	return []string{home}
}

func (s *Store) Get() Config {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cfg
}

func (s *Store) SetMode(m Mode) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if m != ModeAttach && m != ModeEmbed {
		m = ModeAttach
	}
	if m == ModeEmbed {
		// Embed runtime not shipped yet — keep mode request recorded but status clear.
		s.cfg.Mode = ModeEmbed
		s.cfg.EmbedAvailable = false
		s.cfg.EmbedStatus = "scaffold — Virtualization.framework guest not built yet"
	} else {
		s.cfg.Mode = ModeAttach
		s.cfg.EmbedStatus = "not_implemented"
	}
	return s.saveLocked()
}

func (s *Store) Update(fn func(*Config)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	fn(&s.cfg)
	return s.saveLocked()
}

func (s *Store) load() error {
	b, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return err
	}
	if c.Mode == "" {
		c.Mode = ModeAttach
	}
	s.cfg = c
	return nil
}

func (s *Store) saveLocked() error {
	_ = os.MkdirAll(filepath.Dir(s.path), 0o755)
	b, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, append(b, '\n'), 0o644)
}
