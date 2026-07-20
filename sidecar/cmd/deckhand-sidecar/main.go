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
	flag.Parse()

	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		log.Fatalf("listen: %v", err)
	}

	actual := ln.Addr().String()
	fmt.Printf("DECKHAND_SIDECAR_ADDR=%s\n", actual)
	log.Printf("deckhand sidecar listening on %s", actual)

	srv := server.New()
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
