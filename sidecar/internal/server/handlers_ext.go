package server

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/blake/deckhand/sidecar/internal/compose"
	"github.com/blake/deckhand/sidecar/internal/docker"
	"github.com/blake/deckhand/sidecar/internal/engine"
)

func (s *Server) handleDockerContexts(w http.ResponseWriter, r *http.Request) {
	list, err := docker.ListContexts()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	current := s.docker.ActiveContext()
	if current == "" {
		for _, c := range list {
			if c.Current {
				current = c.Name
				break
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"contexts": list, "current": current})
}

func (s *Server) handleDockerUseContext(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
		writeErr(w, http.StatusBadRequest, errOr("name required"))
		return
	}
	err := s.docker.UseContext(body.Name)
	s.audit.Log("docker.context", body.Name, "", err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "name": body.Name})
}

func (s *Server) handleDockerDiagnose(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.docker.Diagnose(r.Context()))
}

func (s *Server) handleVolumeFiles(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	path := r.URL.Query().Get("path")
	entries, err := s.docker.ListVolumeFiles(r.Context(), name, path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *Server) handleVolumeClone(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Source string `json:"source"`
		Dest   string `json:"dest"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	err := s.docker.CloneVolume(r.Context(), body.Source, body.Dest)
	s.audit.Log("volume.clone", body.Source+"->"+body.Dest, "", err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleVolumeExport(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	w.Header().Set("Content-Type", "application/x-tar")
	w.Header().Set("Content-Disposition", "attachment; filename="+name+".tar")
	if err := s.docker.ExportVolume(r.Context(), name, w); err != nil {
		// headers may already be sent
		return
	}
	s.audit.Log("volume.export", name, "", nil)
}

func (s *Server) handleVolumeImport(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	defer r.Body.Close()
	err := s.docker.ImportVolume(r.Context(), name, r.Body)
	s.audit.Log("volume.import", name, "", err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleImageFiles(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	path := r.URL.Query().Get("path")
	entries, err := s.docker.ListImageFiles(r.Context(), id, path)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}

func (s *Server) handleImageScan(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ref := id
	if bodyRef := r.URL.Query().Get("ref"); bodyRef != "" {
		ref = bodyRef
	}
	var body struct {
		Ref string `json:"ref"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Ref != "" {
		ref = body.Ref
	}
	res, err := docker.ScanImage(r.Context(), ref)
	s.audit.Log("image.scan", ref, res.Tool, err)
	// Return partial results even when tool missing (200 with ok:false) for UI
	if err != nil && !res.OK && res.Tool == "" {
		writeJSON(w, http.StatusOK, res)
		return
	}
	if err != nil && !res.OK {
		writeJSON(w, http.StatusOK, res)
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleBuilders(w http.ResponseWriter, r *http.Request) {
	list, err := docker.ListBuilders(r.Context())
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleDockerBuild(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Context    string `json:"context"`
		Dockerfile string `json:"dockerfile"`
		Tag        string `json:"tag"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	flusher, _ := w.(http.Flusher)
	err := docker.BuildImage(r.Context(), body.Context, body.Dockerfile, body.Tag, func(chunk string) {
		_, _ = io.WriteString(w, chunk)
		if flusher != nil {
			flusher.Flush()
		}
	})
	s.audit.Log("docker.build", body.Tag, body.Context, err)
	if err != nil {
		_, _ = io.WriteString(w, "\nERROR: "+err.Error()+"\n")
	}
}

func (s *Server) handleContainerDebug(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	res, err := s.docker.StartDebugShell(r.Context(), id)
	s.audit.Log("container.debug", id, res.ID, err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusCreated, res)
}

func (s *Server) handleRegistrySearch(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	results, err := docker.SearchHub(r.Context(), q, limit)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

func (s *Server) handleRegistryLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Server   string `json:"server"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	err := docker.RegistryLogin(r.Context(), body.Server, body.Username, body.Password)
	s.audit.Log("registry.login", body.Server, body.Username, err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleDaemonJSONGet(w http.ResponseWriter, r *http.Request) {
	path, raw, err := docker.ReadDaemonJSON()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": path, "json": json.RawMessage(raw)})
}

func (s *Server) handleDaemonJSONPut(w http.ResponseWriter, r *http.Request) {
	var body struct {
		JSON json.RawMessage `json:"json"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	path, err := docker.WriteDaemonJSON(body.JSON)
	s.audit.Log("daemon.json", path, "", err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "path": path, "note": "restart Docker engine to apply"})
}

func (s *Server) handleComposeServices(w http.ResponseWriter, r *http.Request) {
	var body compose.UpRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	list, err := s.compose.Services(r.Context(), body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleComposeServiceAction(w http.ResponseWriter, r *http.Request) {
	var body struct {
		compose.UpRequest
		Action   string   `json:"action"`
		Services []string `json:"services"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	out, err := s.compose.ServiceAction(r.Context(), body.UpRequest, body.Action, body.Services)
	s.audit.Log("compose."+body.Action, body.ProjectName, strings.Join(body.Services, ","), err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"output": out})
}

func k8sNS(r *http.Request) string {
	ns := r.URL.Query().Get("namespace")
	if ns == "" {
		return "default"
	}
	return ns
}

func (s *Server) handleK8sServices(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListServices(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sIngresses(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListIngresses(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sConfigMaps(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListConfigMaps(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sSecrets(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListSecrets(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sNodes(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListNodes(r.Context())
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sEvents(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListEvents(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sJobs(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListJobs(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sCronJobs(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListCronJobs(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleK8sStatefulSets(w http.ResponseWriter, r *http.Request) {
	list, err := s.k8s.ListStatefulSets(r.Context(), k8sNS(r))
	if err != nil {
		writeErr(w, http.StatusServiceUnavailable, err)
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) handleAuditTail(w http.ResponseWriter, r *http.Request) {
	n, _ := strconv.Atoi(r.URL.Query().Get("n"))
	if n <= 0 {
		n = 100
	}
	ev, err := s.audit.Tail(n)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": s.audit.Path(), "events": ev})
}

func (s *Server) handleEngineGet(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.engine.Get())
}

func (s *Server) handleEnginePut(w http.ResponseWriter, r *http.Request) {
	var body engine.Config
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	var err error
	if body.Mode != "" {
		err = s.engine.SetMode(body.Mode)
	}
	if err == nil {
		err = s.engine.Update(func(c *engine.Config) {
			if body.CPU > 0 {
				c.CPU = body.CPU
			}
			if body.MemoryMiB > 0 {
				c.MemoryMiB = body.MemoryMiB
			}
			if body.DiskGiB > 0 {
				c.DiskGiB = body.DiskGiB
			}
			c.ResourceSaver = body.ResourceSaver
			if body.VirtioFSShares != nil {
				c.VirtioFSShares = body.VirtioFSShares
			}
		})
	}
	s.audit.Log("engine.update", string(body.Mode), "", err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, s.engine.Get())
}

func (s *Server) handleDomainsStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.domains.Status())
}

func (s *Server) handleDomainsSet(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	err := s.domains.SetEnabled(r.Context(), body.Enabled)
	s.audit.Log("domains", strconv.FormatBool(body.Enabled), "", err)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, s.domains.Status())
}
