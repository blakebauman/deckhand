package main

import (
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/blake/deckhand/sidecar/internal/server"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:0", "listen address (host:port, port 0 = ephemeral)")
	tokenFlag := flag.String("token", "", "shared secret callers must present (default: generated per launch)")
	noAuth := flag.Bool("no-auth", false, "disable authentication — local development only")
	flag.Parse()

	// Precedence: --no-auth, then --token, then DECKHAND_SIDECAR_TOKEN, then a
	// fresh random token. Authenticated by default: the API can create
	// containers with arbitrary bind mounts, so an unauthenticated listener on
	// loopback is reachable by any page the user happens to visit.
	token := ""
	switch {
	case *noAuth:
		log.Print("WARNING: --no-auth: the API is unauthenticated and any local process or web page can control Docker")
	case *tokenFlag != "":
		token = *tokenFlag
	case os.Getenv("DECKHAND_SIDECAR_TOKEN") != "":
		token = os.Getenv("DECKHAND_SIDECAR_TOKEN")
	default:
		generated, err := server.NewToken()
		if err != nil {
			log.Fatalf("generate token: %v", err)
		}
		token = generated
	}

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	actual := ln.Addr().String()
	// Tauri parses both lines off stdout to reach the sidecar.
	fmt.Printf("DECKHAND_SIDECAR_ADDR=%s\n", actual)
	fmt.Printf("DECKHAND_SIDECAR_TOKEN=%s\n", token)
	log.Printf("deckhand sidecar listening on %s", actual)

	srv := server.New(token)
	go func() {
		if err := srv.Serve(ln); err != nil {
			log.Printf("server stopped: %v", err)
		}
	}()

	ch := make(chan os.Signal, 1)
	signal.Notify(ch, syscall.SIGINT, syscall.SIGTERM)
	<-ch
	_ = ln.Close()
}
