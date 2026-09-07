// Thin Deckhand CLI wrapping the local sidecar HTTP API.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	base := env("DECKHAND_URL", "http://127.0.0.1:7420")
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd := os.Args[1]
	args := os.Args[2:]
	switch cmd {
	case "status":
		get(base, "/api/status")
	case "diagnose":
		get(base, "/api/docker/diagnose")
	case "contexts":
		get(base, "/api/docker/contexts")
	case "use-context":
		if len(args) < 1 {
			fatal("use-context <name>")
		}
		postJSON(base, "/api/docker/contexts", map[string]string{"name": args[0]})
	case "ps":
		get(base, "/api/docker/containers?all=true")
	case "audit":
		get(base, "/api/audit?n=50")
	case "engine":
		get(base, "/api/engine")
	case "domains":
		if len(args) == 1 && (args[0] == "on" || args[0] == "off") {
			postJSON(base, "/api/domains", map[string]bool{"enabled": args[0] == "on"})
			return
		}
		get(base, "/api/domains")
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n", cmd)
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprintf(os.Stderr, `deckhand — CLI for the Deckhand sidecar

Usage:
  deckhand status
  deckhand diagnose
  deckhand contexts
  deckhand use-context <name>
  deckhand ps
  deckhand audit
  deckhand engine
  deckhand domains [on|off]

Env:
  DECKHAND_URL    sidecar base URL (default http://127.0.0.1:7420)
  DECKHAND_TOKEN  token printed by the sidecar on startup
`)
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// authed builds a request carrying DECKHAND_TOKEN, which the sidecar requires
// unless it was started with --no-auth.
func authed(method, url string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	if tok := os.Getenv("DECKHAND_TOKEN"); tok != "" {
		req.Header.Set("Authorization", "Bearer "+tok)
	}
	return req, nil
}

func get(base, path string) {
	client := &http.Client{Timeout: 15 * time.Second}
	req, err := authed(http.MethodGet, strings.TrimRight(base, "/")+path, nil)
	if err != nil {
		fatal(err.Error())
	}
	res, err := client.Do(req)
	if err != nil {
		fatal(err.Error())
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		fatal(string(body))
	}
	var pretty any
	if json.Unmarshal(body, &pretty) == nil {
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(pretty)
		return
	}
	fmt.Println(string(body))
}

func postJSON(base, path string, v any) {
	b, _ := json.Marshal(v)
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := authed(http.MethodPost, strings.TrimRight(base, "/")+path, strings.NewReader(string(b)))
	if err != nil {
		fatal(err.Error())
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := client.Do(req)
	if err != nil {
		fatal(err.Error())
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		fatal(string(body))
	}
	fmt.Println(string(body))
}

func fatal(msg string) {
	fmt.Fprintln(os.Stderr, msg)
	os.Exit(1)
}
