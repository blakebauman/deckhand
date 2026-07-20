package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// VulnFinding is one vulnerability from Trivy or Grype.
type VulnFinding struct {
	ID       string `json:"id"`
	Severity string `json:"severity"`
	Package  string `json:"package,omitempty"`
	Title    string `json:"title,omitempty"`
	FixedBy  string `json:"fixedBy,omitempty"`
}

// ScanResult is a vulnerability scan summary.
type ScanResult struct {
	Tool      string        `json:"tool"`
	Image     string        `json:"image"`
	OK        bool          `json:"ok"`
	Error     string        `json:"error,omitempty"`
	Critical  int           `json:"critical"`
	High      int           `json:"high"`
	Medium    int           `json:"medium"`
	Low       int           `json:"low"`
	Unknown   int           `json:"unknown"`
	Findings  []VulnFinding `json:"findings,omitempty"`
	ScannedAt string        `json:"scannedAt"`
}

// ScanImage runs trivy or grype against an image ref/id when available on PATH.
func ScanImage(ctx context.Context, image string) (ScanResult, error) {
	image = strings.TrimSpace(image)
	if image == "" {
		return ScanResult{}, fmt.Errorf("image required")
	}
	res := ScanResult{Image: image, ScannedAt: time.Now().UTC().Format(time.RFC3339)}

	if path, err := exec.LookPath("trivy"); err == nil {
		return runTrivy(ctx, path, image, res)
	}
	if path, err := exec.LookPath("grype"); err == nil {
		return runGrype(ctx, path, image, res)
	}
	res.OK = false
	res.Error = "neither trivy nor grype found on PATH — brew install trivy (or grype)"
	return res, fmt.Errorf("%s", res.Error)
}

func runTrivy(ctx context.Context, bin, image string, res ScanResult) (ScanResult, error) {
	res.Tool = "trivy"
	cctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(cctx, bin, "image", "--quiet", "--format", "json", "--severity", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL", image)
	out, err := cmd.CombinedOutput()
	if err != nil && len(out) == 0 {
		res.OK = false
		res.Error = strings.TrimSpace(string(out)) + ": " + err.Error()
		return res, fmt.Errorf("%s", res.Error)
	}
	var payload struct {
		Results []struct {
			Vulnerabilities []struct {
				VulnerabilityID string `json:"VulnerabilityID"`
				PkgName         string `json:"PkgName"`
				Severity        string `json:"Severity"`
				Title           string `json:"Title"`
				FixedVersion    string `json:"FixedVersion"`
			} `json:"Vulnerabilities"`
		} `json:"Results"`
	}
	if err := json.Unmarshal(out, &payload); err != nil {
		res.OK = false
		res.Error = "parse trivy: " + err.Error()
		return res, fmt.Errorf("%s", res.Error)
	}
	for _, r := range payload.Results {
		for _, v := range r.Vulnerabilities {
			res.Findings = append(res.Findings, VulnFinding{
				ID: v.VulnerabilityID, Severity: v.Severity, Package: v.PkgName,
				Title: v.Title, FixedBy: v.FixedVersion,
			})
			bumpSeverity(&res, v.Severity)
		}
	}
	res.OK = true
	if len(res.Findings) > 40 {
		res.Findings = res.Findings[:40]
	}
	return res, nil
}

func runGrype(ctx context.Context, bin, image string, res ScanResult) (ScanResult, error) {
	res.Tool = "grype"
	cctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(cctx, bin, image, "-o", "json")
	out, err := cmd.CombinedOutput()
	if err != nil && !bytes.Contains(out, []byte(`"matches"`)) {
		res.OK = false
		res.Error = strings.TrimSpace(string(out))
		return res, fmt.Errorf("%s", res.Error)
	}
	var payload struct {
		Matches []struct {
			Vulnerability struct {
				ID          string `json:"id"`
				Severity    string `json:"severity"`
				Description string `json:"description"`
				Fix         struct {
					Versions []string `json:"versions"`
				} `json:"fix"`
			} `json:"vulnerability"`
			Artifact struct {
				Name string `json:"name"`
			} `json:"artifact"`
		} `json:"matches"`
	}
	if err := json.Unmarshal(out, &payload); err != nil {
		res.OK = false
		res.Error = "parse grype: " + err.Error()
		return res, fmt.Errorf("%s", res.Error)
	}
	for _, m := range payload.Matches {
		fixed := ""
		if len(m.Vulnerability.Fix.Versions) > 0 {
			fixed = m.Vulnerability.Fix.Versions[0]
		}
		res.Findings = append(res.Findings, VulnFinding{
			ID: m.Vulnerability.ID, Severity: m.Vulnerability.Severity,
			Package: m.Artifact.Name, Title: m.Vulnerability.Description, FixedBy: fixed,
		})
		bumpSeverity(&res, m.Vulnerability.Severity)
	}
	res.OK = true
	if len(res.Findings) > 40 {
		res.Findings = res.Findings[:40]
	}
	return res, nil
}

func bumpSeverity(res *ScanResult, sev string) {
	switch strings.ToUpper(sev) {
	case "CRITICAL":
		res.Critical++
	case "HIGH":
		res.High++
	case "MEDIUM":
		res.Medium++
	case "LOW":
		res.Low++
	default:
		res.Unknown++
	}
}
