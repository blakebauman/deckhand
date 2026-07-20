package server

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/blake/deckhand/sidecar/internal/compose"
	"github.com/blake/deckhand/sidecar/internal/docker"
	"github.com/blake/deckhand/sidecar/internal/helm"
	"github.com/blake/deckhand/sidecar/internal/k8s"
	"github.com/blake/deckhand/sidecar/internal/runtime"
)

type Server struct {
	mux      *http.ServeMux
	docker   *docker.Client
	compose  *compose.Service
	k8s      *k8s.Client
	helm     *helm.Service
	runtimes *runtime.Registry
}

func New() *Server {
	s := &Server{
		mux:      http.NewServeMux(),
		docker:   docker.New(),
		compose:  compose.New(),
		k8s:      k8s.New(),
		helm:     helm.New(),
		runtimes: runtime.NewRegistry(runtime.NewFirecracker()),
	}
	s.routes()
	return s
}

func (s *Server) Serve(ln net.Listener) error {
	return http.Serve(ln, cors(s.mux))
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) routes() {
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("GET /api/status", s.handleStatus)

	s.mux.HandleFunc("GET /api/docker/info", s.handleDockerInfo)
	s.mux.HandleFunc("GET /api/docker/dashboard", s.handleDockerDashboard)
	s.mux.HandleFunc("GET /api/docker/gpus", s.handleDockerGPUs)
	s.mux.HandleFunc("GET /api/docker/containers", s.handleContainers)
	s.mux.HandleFunc("POST /api/docker/containers", s.handleContainerCreate)
	s.mux.HandleFunc("GET /api/docker/containers/{id}", s.handleContainerInspect)
	s.mux.HandleFunc("POST /api/docker/containers/{id}/start", s.handleContainerStart)
	s.mux.HandleFunc("POST /api/docker/containers/{id}/stop", s.handleContainerStop)
	s.mux.HandleFunc("POST /api/docker/containers/{id}/restart", s.handleContainerRestart)
	s.mux.HandleFunc("DELETE /api/docker/containers/{id}", s.handleContainerRemove)
	s.mux.HandleFunc("GET /api/docker/containers/{id}/logs", s.handleContainerLogs)
	s.mux.HandleFunc("POST /api/docker/containers/{id}/exec", s.handleContainerExec)
	s.mux.HandleFunc("GET /api/docker/containers/{id}/exec/ws", s.handleContainerExecWS)
	s.mux.HandleFunc("GET /api/docker/containers/{id}/stats", s.handleContainerStats)
	s.mux.HandleFunc("POST /api/docker/containers/bulk", s.handleContainersBulk)
	s.mux.HandleFunc("GET /api/docker/images", s.handleImages)
	s.mux.HandleFunc("POST /api/docker/images/pull", s.handleImagePull)
	s.mux.HandleFunc("DELETE /api/docker/images/{id}", s.handleImageRemove)
	s.mux.HandleFunc("POST /api/docker/images/prune", s.handleImagePrune)
	s.mux.HandleFunc("GET /api/docker/volumes", s.handleVolumes)
	s.mux.HandleFunc("POST /api/docker/volumes", s.handleVolumeCreate)
	s.mux.HandleFunc("GET /api/docker/volumes/{name}", s.handleVolumeInspect)
	s.mux.HandleFunc("DELETE /api/docker/volumes/{name}", s.handleVolumeRemove)
	s.mux.HandleFunc("GET /api/docker/networks", s.handleNetworks)
	s.mux.HandleFunc("POST /api/docker/networks", s.handleNetworkCreate)
	s.mux.HandleFunc("GET /api/docker/networks/{id}", s.handleNetworkInspect)
	s.mux.HandleFunc("DELETE /api/docker/networks/{id}", s.handleNetworkRemove)
	s.mux.HandleFunc("GET /api/docker/events", s.handleDockerEvents)
	s.mux.HandleFunc("GET /api/docker/system/df", s.handleSystemDf)
	s.mux.HandleFunc("POST /api/docker/system/prune", s.handleSystemPrune)

	s.mux.HandleFunc("GET /api/compose/projects", s.handleComposeProjects)
	s.mux.HandleFunc("POST /api/compose/discover", s.handleComposeDiscover)
	s.mux.HandleFunc("POST /api/compose/up", s.handleComposeUp)
	s.mux.HandleFunc("POST /api/compose/down", s.handleComposeDown)
	s.mux.HandleFunc("POST /api/compose/restart", s.handleComposeRestart)
	s.mux.HandleFunc("POST /api/compose/ps", s.handleComposePs)

	s.mux.HandleFunc("GET /api/k8s/status", s.handleK8sStatus)
	s.mux.HandleFunc("GET /api/k8s/contexts", s.handleK8sContexts)
	s.mux.HandleFunc("POST /api/k8s/contexts", s.handleK8sUseContext)
	s.mux.HandleFunc("GET /api/k8s/namespaces", s.handleK8sNamespaces)
	s.mux.HandleFunc("GET /api/k8s/pods", s.handleK8sPods)
	s.mux.HandleFunc("GET /api/k8s/pods/{ns}/{name}", s.handleK8sPodGet)
	s.mux.HandleFunc("DELETE /api/k8s/pods/{ns}/{name}", s.handleK8sPodDelete)
	s.mux.HandleFunc("GET /api/k8s/pods/{ns}/{name}/logs", s.handleK8sPodLogs)
	s.mux.HandleFunc("POST /api/k8s/pods/{ns}/{name}/exec", s.handleK8sPodExec)
	s.mux.HandleFunc("GET /api/k8s/pods/{ns}/{name}/exec/ws", s.handleK8sPodExecWS)
	s.mux.HandleFunc("GET /api/k8s/deployments", s.handleK8sDeployments)
	s.mux.HandleFunc("GET /api/k8s/deployments/{ns}/{name}", s.handleK8sDeploymentGet)
	s.mux.HandleFunc("POST /api/k8s/deployments/{ns}/{name}/scale", s.handleK8sDeploymentScale)
	s.mux.HandleFunc("POST /api/k8s/deployments/{ns}/{name}/restart", s.handleK8sDeploymentRestart)
	s.mux.HandleFunc("DELETE /api/k8s/deployments/{ns}/{name}", s.handleK8sDeploymentDelete)

	s.mux.HandleFunc("GET /api/helm/releases", s.handleHelmList)
	s.mux.HandleFunc("GET /api/helm/releases/{ns}/{name}", s.handleHelmGet)
	s.mux.HandleFunc("POST /api/helm/install", s.handleHelmInstall)
	s.mux.HandleFunc("POST /api/helm/upgrade", s.handleHelmUpgrade)
	s.mux.HandleFunc("POST /api/helm/rollback", s.handleHelmRollback)
	s.mux.HandleFunc("DELETE /api/helm/releases/{ns}/{name}", s.handleHelmUninstall)

	s.mux.HandleFunc("GET /api/runtimes", s.handleRuntimes)
	s.mux.HandleFunc("GET /api/runtimes/firecracker/vms", s.handleFCList)
	s.mux.HandleFunc("POST /api/runtimes/firecracker/vms", s.handleFCCreate)
	s.mux.HandleFunc("POST /api/runtimes/firecracker/vms/{id}/start", s.handleFCStart)
	s.mux.HandleFunc("POST /api/runtimes/firecracker/vms/{id}/stop", s.handleFCStop)
	s.mux.HandleFunc("DELETE /api/runtimes/firecracker/vms/{id}", s.handleFCDestroy)
	s.mux.HandleFunc("GET /api/runtimes/firecracker/vms/{id}/logs", s.handleFCLogs)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "deckhand-sidecar"})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	dockerOK := s.docker.Ping(ctx) == nil
	k8sVersion := ""
	k8sOK := false
	if v, err := s.k8s.Probe(ctx); err == nil {
		k8sOK = true
		k8sVersion = v
	}
	fc := s.runtimes.Get("firecracker")
	fcOK := fc != nil && fc.Available(ctx)
	writeJSON(w, http.StatusOK, map[string]any{
		"docker":      map[string]any{"connected": dockerOK, "error": errString(s.docker.Err())},
		"kubernetes":  map[string]any{"connected": k8sOK, "version": k8sVersion, "error": errString(s.k8s.Err())},
		"firecracker": map[string]any{"available": fcOK},
	})
}

func errString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func (s *Server) handleDockerInfo(w http.ResponseWriter, r *http.Request) {
	info, err := s.docker.Info(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func (s *Server) handleDockerDashboard(w http.ResponseWriter, r *http.Request) {
	counts, err := docker.DashboardCounts(r.Context(), s.docker)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, counts)
}

func (s *Server) handleDockerGPUs(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.docker.GPUStatus(r.Context()))
}

func (s *Server) handleContainers(w http.ResponseWriter, r *http.Request) {
	all := r.URL.Query().Get("all") != "false"
	list, err := s.docker.ListContainers(r.Context(), all)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleContainerCreate(w http.ResponseWriter, r *http.Request) {
	var body docker.RunOptions
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	res, err := s.docker.CreateAndRun(r.Context(), body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (s *Server) handleSystemDf(w http.ResponseWriter, r *http.Request) {
	sum, err := s.docker.DiskUsage(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, sum)
}

func (s *Server) handleSystemPrune(w http.ResponseWriter, r *http.Request) {
	var body docker.PruneOptions
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if !body.Containers && !body.Images && !body.Volumes && !body.Networks && !body.BuildCache {
		writeErr(w, http.StatusBadRequest, errOr("select at least one resource to prune"))
		return
	}
	res, err := s.docker.SystemPrune(r.Context(), body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleContainerInspect(w http.ResponseWriter, r *http.Request) {
	ct, err := s.docker.InspectContainer(r.Context(), r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, ct)
}

func (s *Server) handleContainerStart(w http.ResponseWriter, r *http.Request) {
	if err := s.docker.StartContainer(r.Context(), r.PathValue("id")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleContainerStop(w http.ResponseWriter, r *http.Request) {
	if err := s.docker.StopContainer(r.Context(), r.PathValue("id"), nil); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleContainerRestart(w http.ResponseWriter, r *http.Request) {
	if err := s.docker.RestartContainer(r.Context(), r.PathValue("id"), nil); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleContainerRemove(w http.ResponseWriter, r *http.Request) {
	force := r.URL.Query().Get("force") == "true"
	if err := s.docker.RemoveContainer(r.Context(), r.PathValue("id"), force); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleContainerLogs(w http.ResponseWriter, r *http.Request) {
	follow := r.URL.Query().Get("follow") == "true"
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "200"
	}
	rc, err := s.docker.ContainerLogs(r.Context(), r.PathValue("id"), follow, tail)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	defer rc.Close()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	flusher, _ := w.(http.Flusher)
	pr, pw := io.Pipe()
	go func() {
		_ = docker.DemuxLogs(rc, pw)
		_ = pw.Close()
	}()
	buf := make([]byte, 4096)
	for {
		n, err := pr.Read(buf)
		if n > 0 {
			_, _ = w.Write(buf[:n])
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			return
		}
	}
}

func (s *Server) handleContainerExec(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Cmd []string `json:"cmd"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	out, err := s.docker.Exec(r.Context(), r.PathValue("id"), body.Cmd)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleContainerStats(w http.ResponseWriter, r *http.Request) {
	stream := r.URL.Query().Get("stream") == "true"
	rc, err := s.docker.ContainerStats(r.Context(), r.PathValue("id"), stream)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	defer rc.Close()

	if !stream {
		sample, err := docker.DecodeOneStats(rc)
		if err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		writeJSON(w, http.StatusOK, sample)
		return
	}

	// Live stream — NDJSON samples (docker stats style).
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, errOr("streaming unsupported"))
		return
	}
	enc := json.NewEncoder(w)
	_ = docker.StreamStats(rc, func(sample *docker.StatsSample) error {
		if err := enc.Encode(sample); err != nil {
			return err
		}
		flusher.Flush()
		select {
		case <-r.Context().Done():
			return io.EOF
		default:
			return nil
		}
	})
}

func (s *Server) handleContainersBulk(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs    []string `json:"ids"`
		Action string   `json:"action"` // start|stop|restart|remove
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.IDs) == 0 {
		writeErr(w, http.StatusBadRequest, errOr("ids and action required"))
		return
	}
	var errs []string
	for _, id := range body.IDs {
		var err error
		switch body.Action {
		case "start":
			err = s.docker.StartContainer(r.Context(), id)
		case "stop":
			err = s.docker.StopContainer(r.Context(), id, nil)
		case "restart":
			err = s.docker.RestartContainer(r.Context(), id, nil)
		case "remove":
			err = s.docker.RemoveContainer(r.Context(), id, true)
		default:
			writeErr(w, http.StatusBadRequest, errOr("unknown action"))
			return
		}
		if err != nil {
			errs = append(errs, id+": "+err.Error())
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": len(errs) == 0, "errors": errs})
}

func (s *Server) handleImages(w http.ResponseWriter, r *http.Request) {
	list, err := s.docker.ListImages(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleImagePull(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Ref string `json:"ref"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Ref == "" {
		writeErr(w, http.StatusBadRequest, errOr("ref required"))
		return
	}
	rc, err := s.docker.PullImage(r.Context(), body.Ref)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	defer rc.Close()
	// Stream Docker pull progress JSON lines to the console.
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, err := rc.Read(buf)
		if n > 0 {
			_, _ = w.Write(buf[:n])
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			return
		}
	}
}

func (s *Server) handleImageRemove(w http.ResponseWriter, r *http.Request) {
	force := r.URL.Query().Get("force") == "true"
	res, err := s.docker.RemoveImage(r.Context(), r.PathValue("id"), force)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleImagePrune(w http.ResponseWriter, r *http.Request) {
	res, err := s.docker.PruneImages(r.Context())
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleVolumes(w http.ResponseWriter, r *http.Request) {
	res, err := s.docker.ListVolumes(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, res.Volumes)
}

func (s *Server) handleVolumeCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeErr(w, http.StatusBadRequest, errOr("name required"))
		return
	}
	vol, err := s.docker.CreateVolume(r.Context(), body.Name)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, vol)
}

func (s *Server) handleVolumeInspect(w http.ResponseWriter, r *http.Request) {
	vol, err := s.docker.InspectVolume(r.Context(), r.PathValue("name"))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, vol)
}

func (s *Server) handleVolumeRemove(w http.ResponseWriter, r *http.Request) {
	force := r.URL.Query().Get("force") == "true"
	if err := s.docker.RemoveVolume(r.Context(), r.PathValue("name"), force); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleNetworks(w http.ResponseWriter, r *http.Request) {
	list, err := s.docker.ListNetworks(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleNetworkCreate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name   string `json:"name"`
		Driver string `json:"driver"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeErr(w, http.StatusBadRequest, errOr("name required"))
		return
	}
	res, err := s.docker.CreateNetwork(r.Context(), body.Name, body.Driver)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (s *Server) handleNetworkInspect(w http.ResponseWriter, r *http.Request) {
	n, err := s.docker.InspectNetwork(r.Context(), r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, n)
}

func (s *Server) handleNetworkRemove(w http.ResponseWriter, r *http.Request) {
	if err := s.docker.RemoveNetwork(r.Context(), r.PathValue("id")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleDockerEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	messages, errs := s.docker.Events(ctx)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, http.StatusInternalServerError, errOr("streaming unsupported"))
		return
	}
	for {
		select {
		case <-ctx.Done():
			return
		case err := <-errs:
			if err != nil {
				log.Printf("docker events: %v", err)
			}
			return
		case msg, ok := <-messages:
			if !ok {
				return
			}
			b, _ := json.Marshal(msg)
			_, _ = w.Write([]byte("data: " + string(b) + "\n\n"))
			flusher.Flush()
		}
	}
}

func (s *Server) handleComposeProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := s.compose.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) handleComposeDiscover(w http.ResponseWriter, r *http.Request) {
	var req compose.DiscoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	projects, err := s.compose.Discover(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) handleComposeUp(w http.ResponseWriter, r *http.Request) {
	var req compose.UpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.compose.Up(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleComposeDown(w http.ResponseWriter, r *http.Request) {
	var req compose.UpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.compose.Down(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleComposeRestart(w http.ResponseWriter, r *http.Request) {
	var req compose.UpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.compose.Restart(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleComposePs(w http.ResponseWriter, r *http.Request) {
	var req compose.UpRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.compose.Ps(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleK8sStatus(w http.ResponseWriter, r *http.Request) {
	v, err := s.k8s.Probe(r.Context())
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"connected": false, "error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"connected": true, "version": v})
}

func (s *Server) handleK8sContexts(w http.ResponseWriter, r *http.Request) {
	list, current, err := s.k8s.ListContexts()
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"contexts": list, "current": current})
}

func (s *Server) handleK8sUseContext(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeErr(w, http.StatusBadRequest, errOr("name required"))
		return
	}
	if err := s.k8s.UseContext(body.Name); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleK8sNamespaces(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListNamespaces(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	names := make([]string, 0, len(list))
	for _, ns := range list {
		names = append(names, ns.Name)
	}
	writeJSON(w, http.StatusOK, names)
}

func (s *Server) handleK8sPods(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}
	list, err := s.k8s.ListPods(r.Context(), ns)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sPodGet(w http.ResponseWriter, r *http.Request) {
	pod, err := s.k8s.GetPod(r.Context(), r.PathValue("ns"), r.PathValue("name"))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, pod)
}

func (s *Server) handleK8sPodDelete(w http.ResponseWriter, r *http.Request) {
	if err := s.k8s.DeletePod(r.Context(), r.PathValue("ns"), r.PathValue("name")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleK8sPodExec(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Cmd       []string `json:"cmd"`
		Container string   `json:"container"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	out, err := s.k8s.Exec(r.Context(), r.PathValue("ns"), r.PathValue("name"), body.Container, body.Cmd)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleK8sPodLogs(w http.ResponseWriter, r *http.Request) {
	follow := r.URL.Query().Get("follow") == "true"
	container := r.URL.Query().Get("container")
	tail := int64(200)
	if t := r.URL.Query().Get("tail"); t != "" {
		if n, err := strconv.ParseInt(t, 10, 64); err == nil {
			tail = n
		}
	}
	rc, err := s.k8s.PodLogs(r.Context(), r.PathValue("ns"), r.PathValue("name"), container, follow, tail)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	defer rc.Close()
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 4096)
	for {
		n, err := rc.Read(buf)
		if n > 0 {
			_, _ = w.Write(buf[:n])
			if flusher != nil {
				flusher.Flush()
			}
		}
		if err != nil {
			return
		}
	}
}

func (s *Server) handleK8sDeployments(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		ns = "default"
	}
	list, err := s.k8s.ListDeployments(r.Context(), ns)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sDeploymentGet(w http.ResponseWriter, r *http.Request) {
	d, err := s.k8s.GetDeployment(r.Context(), r.PathValue("ns"), r.PathValue("name"))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

func (s *Server) handleK8sDeploymentScale(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Replicas int32 `json:"replicas"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.k8s.ScaleDeployment(r.Context(), r.PathValue("ns"), r.PathValue("name"), body.Replicas); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleK8sDeploymentRestart(w http.ResponseWriter, r *http.Request) {
	if err := s.k8s.RestartDeployment(r.Context(), r.PathValue("ns"), r.PathValue("name")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleK8sDeploymentDelete(w http.ResponseWriter, r *http.Request) {
	if err := s.k8s.DeleteDeployment(r.Context(), r.PathValue("ns"), r.PathValue("name")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleHelmList(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")
	all := r.URL.Query().Get("allNamespaces") == "true"
	list, err := s.helm.List(r.Context(), ns, all)
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleHelmGet(w http.ResponseWriter, r *http.Request) {
	res, err := s.helm.Get(r.Context(), r.PathValue("ns"), r.PathValue("name"))
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleHelmInstall(w http.ResponseWriter, r *http.Request) {
	var req helm.InstallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.helm.Install(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleHelmUpgrade(w http.ResponseWriter, r *http.Request) {
	var req helm.InstallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.helm.Upgrade(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleHelmRollback(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Namespace string `json:"namespace"`
		Name      string `json:"name"`
		Revision  int    `json:"revision"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.helm.Rollback(r.Context(), body.Namespace, body.Name, body.Revision)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleHelmUninstall(w http.ResponseWriter, r *http.Request) {
	out, err := s.helm.Uninstall(r.Context(), r.PathValue("ns"), r.PathValue("name"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

func (s *Server) handleRuntimes(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	type info struct {
		Name      string `json:"name"`
		Available bool   `json:"available"`
	}
	out := []info{}
	for _, p := range s.runtimes.All() {
		out = append(out, info{Name: p.Name(), Available: p.Available(ctx)})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) fc() runtime.Provider {
	return s.runtimes.Get("firecracker")
}

func (s *Server) handleFCList(w http.ResponseWriter, r *http.Request) {
	p := s.fc()
	if p == nil || !p.Available(r.Context()) {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	list, err := p.List(r.Context())
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleFCCreate(w http.ResponseWriter, r *http.Request) {
	p := s.fc()
	if p == nil {
		writeErr(w, http.StatusServiceUnavailable, errOr("firecracker unavailable"))
		return
	}
	var req runtime.CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	vm, err := p.Create(r.Context(), req)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, vm)
}

func (s *Server) handleFCStart(w http.ResponseWriter, r *http.Request) {
	if err := s.fc().Start(r.Context(), r.PathValue("id")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleFCStop(w http.ResponseWriter, r *http.Request) {
	if err := s.fc().Stop(r.Context(), r.PathValue("id")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleFCDestroy(w http.ResponseWriter, r *http.Request) {
	if err := s.fc().Destroy(r.Context(), r.PathValue("id")); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleFCLogs(w http.ResponseWriter, r *http.Request) {
	p := s.fc()
	if p == nil {
		writeErr(w, http.StatusServiceUnavailable, errOr("firecracker unavailable"))
		return
	}
	out, err := p.Logs(r.Context(), r.PathValue("id"))
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"output": out})
}

type simpleError string

func (e simpleError) Error() string { return string(e) }

func errOr(msg string) error {
	return simpleError(msg)
}
