package server

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var wsUpgrader = websocket.Upgrader{
	ReadBufferSize:  8192,
	WriteBufferSize: 8192,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type ttyControl struct {
	Type string `json:"type"`
	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

func parseShellCmd(r *http.Request) []string {
	shell := strings.TrimSpace(r.URL.Query().Get("shell"))
	switch shell {
	case "bash":
		return []string{"/bin/bash", "-l"}
	case "ash":
		return []string{"/bin/ash"}
	case "":
		return []string{"/bin/sh"}
	default:
		if strings.HasPrefix(shell, "/") {
			return []string{shell}
		}
		return []string{"/bin/sh"}
	}
}

func (s *Server) handleContainerExecWS(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("exec ws upgrade: %v", err)
		return
	}
	defer conn.Close()

	id := r.PathValue("id")
	cmd := parseShellCmd(r)
	session, err := s.docker.ExecTTY(r.Context(), id, cmd)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("error: "+err.Error()+"\r\n"))
		return
	}
	defer session.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	var writeMu sync.Mutex
	writeBinary := func(p []byte) error {
		writeMu.Lock()
		defer writeMu.Unlock()
		_ = conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
		return conn.WriteMessage(websocket.BinaryMessage, p)
	}

	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := session.Stdout.Read(buf)
			if n > 0 {
				if werr := writeBinary(buf[:n]); werr != nil {
					cancel()
					return
				}
			}
			if err != nil {
				cancel()
				return
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		_ = conn.SetReadDeadline(time.Now().Add(10 * time.Minute))
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if msgType == websocket.TextMessage && len(data) > 0 && data[0] == '{' {
			var ctrl ttyControl
			if json.Unmarshal(data, &ctrl) == nil && ctrl.Type == "resize" {
				_ = s.docker.ResizeTTY(ctx, session.ID, uint(ctrl.Cols), uint(ctrl.Rows))
				continue
			}
		}
		if len(data) == 0 {
			continue
		}
		if _, err := session.Stdin.Write(data); err != nil {
			return
		}
	}
}

type wsConnWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (w *wsConnWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	_ = w.conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
	if err := w.conn.WriteMessage(websocket.BinaryMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

func (s *Server) handleK8sPodExecWS(w http.ResponseWriter, r *http.Request) {
	conn, err := wsUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("k8s exec ws upgrade: %v", err)
		return
	}
	defer conn.Close()

	ns := r.PathValue("ns")
	name := r.PathValue("name")
	containerName := r.URL.Query().Get("container")
	cmd := parseShellCmd(r)

	pr, pw := io.Pipe()
	stdout := &wsConnWriter{conn: conn}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	resize, wait, err := s.k8s.ExecTTY(ctx, ns, name, containerName, cmd, pr, stdout)
	if err != nil {
		_ = conn.WriteMessage(websocket.TextMessage, []byte("error: "+err.Error()+"\r\n"))
		_ = pw.Close()
		return
	}

	go func() {
		err := wait()
		cancel()
		_ = pw.Close()
		if err != nil && err != io.EOF && !strings.Contains(err.Error(), "closed") {
			log.Printf("k8s exec stream: %v", err)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		_ = conn.SetReadDeadline(time.Now().Add(10 * time.Minute))
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			cancel()
			_ = pw.Close()
			return
		}
		if msgType == websocket.TextMessage && len(data) > 0 && data[0] == '{' {
			var ctrl ttyControl
			if json.Unmarshal(data, &ctrl) == nil && ctrl.Type == "resize" {
				resize(ctrl.Cols, ctrl.Rows)
				continue
			}
		}
		if len(data) == 0 {
			continue
		}
		if _, err := pw.Write(data); err != nil {
			cancel()
			return
		}
	}
}
