package domains

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/blake/deckhand/sidecar/internal/docker"
)

// Manager provides *.deckhand.local style reverse proxy to container ports.
type Manager struct {
	mu         sync.RWMutex
	enabled    bool
	lnHTTP     net.Listener
	lnHTTPS    net.Listener
	srvHTTP    *http.Server
	srvHTTPS   *http.Server
	docker     *docker.Client
	httpAddr   string
	httpsAddr  string
	suffix     string
	tlsCertPEM string
}

func New(d *docker.Client) *Manager {
	return &Manager{
		docker:    d,
		suffix:    ".deckhand.local",
		httpAddr:  "127.0.0.1:8787",
		httpsAddr: "127.0.0.1:8788",
	}
}

func (m *Manager) Status() map[string]any {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return map[string]any{
		"enabled":   m.enabled,
		"addr":      m.httpAddr,
		"httpsAddr": m.httpsAddr,
		"suffix":    m.suffix,
		"hint":      "Point *.deckhand.local at 127.0.0.1, then open http://<container>" + m.suffix + ":8787 or https://…:8788 (self-signed).",
		"dns": map[string]string{
			"macosResolverPath": "/etc/resolver/deckhand.local",
			"macosResolverBody": "nameserver 127.0.0.1\n",
			"hostsExample":      "127.0.0.1 myapp.deckhand.local",
			"note":              "macOS: create /etc/resolver/deckhand.local (needs sudo) OR add hosts entries. Or use dnsmasq address=/.deckhand.local/127.0.0.1",
		},
	}
}

func (m *Manager) SetEnabled(ctx context.Context, on bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if on && !m.enabled {
		if err := m.startLocked(); err != nil {
			return err
		}
		m.enabled = true
		return nil
	}
	if !on && m.enabled {
		m.stopLocked()
		m.enabled = false
	}
	return nil
}

func (m *Manager) startLocked() error {
	handler := http.HandlerFunc(m.handle)

	lnHTTP, err := net.Listen("tcp", m.httpAddr)
	if err != nil {
		return fmt.Errorf("http listen: %w", err)
	}
	m.lnHTTP = lnHTTP
	m.srvHTTP = &http.Server{Handler: handler}
	go func() { _ = m.srvHTTP.Serve(lnHTTP) }()

	cert, err := selfSignedCert()
	if err != nil {
		m.stopLocked()
		return fmt.Errorf("tls cert: %w", err)
	}
	m.tlsCertPEM = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: cert.Certificate[0]}))

	lnTLS, err := tls.Listen("tcp", m.httpsAddr, &tls.Config{Certificates: []tls.Certificate{cert}})
	if err != nil {
		m.stopLocked()
		return fmt.Errorf("https listen: %w", err)
	}
	m.lnHTTPS = lnTLS
	m.srvHTTPS = &http.Server{Handler: handler}
	go func() { _ = m.srvHTTPS.Serve(lnTLS) }()
	return nil
}

func (m *Manager) stopLocked() {
	shutdown := func(srv *http.Server) {
		if srv == nil {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = srv.Shutdown(ctx)
		cancel()
	}
	shutdown(m.srvHTTP)
	shutdown(m.srvHTTPS)
	m.srvHTTP, m.srvHTTPS = nil, nil
	if m.lnHTTP != nil {
		_ = m.lnHTTP.Close()
		m.lnHTTP = nil
	}
	if m.lnHTTPS != nil {
		_ = m.lnHTTPS.Close()
		m.lnHTTPS = nil
	}
}

func (m *Manager) handle(w http.ResponseWriter, r *http.Request) {
	host := r.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	name := strings.TrimSuffix(host, m.suffix)
	name = strings.TrimSuffix(name, ".")
	if name == "" || name == host {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintf(w, "Deckhand domains\n\nUse http://<container-name>%s:%s or https://…:%s\nMap DNS *.deckhand.local → 127.0.0.1\n",
			m.suffix, strings.TrimPrefix(m.httpAddr, "127.0.0.1:"), strings.TrimPrefix(m.httpsAddr, "127.0.0.1:"))
		return
	}
	target, err := m.resolveContainer(r.Context(), name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	u, _ := url.Parse(target)
	proxy := httputil.NewSingleHostReverseProxy(u)
	proxy.ServeHTTP(w, r)
}

func (m *Manager) resolveContainer(ctx context.Context, name string) (string, error) {
	ctrs, err := m.docker.ListContainers(ctx, false)
	if err != nil {
		return "", err
	}
	for _, c := range ctrs {
		cname := docker.ContainerName(c.Names)
		if cname == name || strings.TrimPrefix(cname, "/") == name {
			for _, p := range c.Ports {
				if p.PublicPort > 0 {
					return fmt.Sprintf("http://127.0.0.1:%d", p.PublicPort), nil
				}
			}
			return "", fmt.Errorf("container %q has no published ports", name)
		}
	}
	return "", fmt.Errorf("running container %q not found", name)
}

func selfSignedCert() (tls.Certificate, error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return tls.Certificate{}, err
	}
	serial, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		return tls.Certificate{}, err
	}
	tmpl := &x509.Certificate{
		SerialNumber: serial,
		Subject:      pkix.Name{Organization: []string{"Deckhand"}, CommonName: "*.deckhand.local"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(365 * 24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"deckhand.local", "*.deckhand.local", "localhost"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return tls.Certificate{}, err
	}
	certPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	keyDER, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		return tls.Certificate{}, err
	}
	keyPEM := pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDER})
	return tls.X509KeyPair(certPEM, keyPEM)
}
