package k8s

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	clientset *kubernetes.Clientset
	config    *rest.Config
	rawCfg    clientcmd.ClientConfig
	err       error
}

func New() *Client {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfig := os.Getenv("KUBECONFIG"); kubeconfig != "" {
		loadingRules.ExplicitPath = kubeconfig
	} else {
		home, _ := os.UserHomeDir()
		loadingRules.ExplicitPath = filepath.Join(home, ".kube", "config")
	}
	overrides := &clientcmd.ConfigOverrides{}
	rawCfg := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, overrides)
	cfg, err := rawCfg.ClientConfig()
	if err != nil {
		return &Client{err: err, rawCfg: rawCfg}
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return &Client{err: err, rawCfg: rawCfg}
	}
	return &Client{clientset: cs, config: cfg, rawCfg: rawCfg}
}

func (c *Client) Ready() bool { return c.clientset != nil && c.err == nil }
func (c *Client) Err() error  { return c.err }

func (c *Client) ensureReady() error {
	if c.Ready() {
		return nil
	}
	if c.err != nil {
		return c.err
	}
	return fmt.Errorf("kubernetes client unavailable")
}

func (c *Client) Probe(ctx context.Context) (string, error) {
	if err := c.ensureReady(); err != nil {
		return "", err
	}
	v, err := c.clientset.Discovery().ServerVersion()
	if err != nil {
		return "", err
	}
	return v.GitVersion, nil
}

type ContextInfo struct {
	Name      string `json:"name"`
	Cluster   string `json:"cluster"`
	Namespace string `json:"namespace"`
	Current   bool   `json:"current"`
}

func (c *Client) ListContexts() ([]ContextInfo, string, error) {
	if c.rawCfg == nil {
		return nil, "", fmt.Errorf("kubeconfig unavailable")
	}
	cfg, err := c.rawCfg.RawConfig()
	if err != nil {
		return nil, "", err
	}
	out := make([]ContextInfo, 0, len(cfg.Contexts))
	for name, ctx := range cfg.Contexts {
		ns := ctx.Namespace
		if ns == "" {
			ns = "default"
		}
		out = append(out, ContextInfo{
			Name: name, Cluster: ctx.Cluster, Namespace: ns, Current: name == cfg.CurrentContext,
		})
	}
	return out, cfg.CurrentContext, nil
}

func (c *Client) UseContext(name string) error {
	path := clientcmd.RecommendedHomeFile
	if k := os.Getenv("KUBECONFIG"); k != "" {
		path = k
	}
	cfg, err := clientcmd.LoadFromFile(path)
	if err != nil {
		return err
	}
	if _, ok := cfg.Contexts[name]; !ok {
		return fmt.Errorf("context %q not found", name)
	}
	cfg.CurrentContext = name
	if err := clientcmd.WriteToFile(*cfg, path); err != nil {
		return err
	}
	*c = *New()
	return nil
}

func (c *Client) ListNamespaces(ctx context.Context) ([]corev1.Namespace, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListPods(ctx context.Context, ns string) ([]corev1.Pod, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) GetPod(ctx context.Context, ns, name string) (*corev1.Pod, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	return c.clientset.CoreV1().Pods(ns).Get(ctx, name, metav1.GetOptions{})
}

func (c *Client) DeletePod(ctx context.Context, ns, name string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	return c.clientset.CoreV1().Pods(ns).Delete(ctx, name, metav1.DeleteOptions{})
}

func (c *Client) PodLogs(ctx context.Context, ns, name, container string, follow bool, tail int64) (io.ReadCloser, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	opts := &corev1.PodLogOptions{Follow: follow, Timestamps: true}
	if container != "" {
		opts.Container = container
	}
	if tail > 0 {
		opts.TailLines = &tail
	}
	return c.clientset.CoreV1().Pods(ns).GetLogs(name, opts).Stream(ctx)
}

func (c *Client) ListDeployments(ctx context.Context, ns string) ([]appsv1.Deployment, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.AppsV1().Deployments(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) GetDeployment(ctx context.Context, ns, name string) (*appsv1.Deployment, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	return c.clientset.AppsV1().Deployments(ns).Get(ctx, name, metav1.GetOptions{})
}

func (c *Client) ScaleDeployment(ctx context.Context, ns, name string, replicas int32) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	scale, err := c.clientset.AppsV1().Deployments(ns).GetScale(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	scale.Spec.Replicas = replicas
	_, err = c.clientset.AppsV1().Deployments(ns).UpdateScale(ctx, name, scale, metav1.UpdateOptions{})
	return err
}

func (c *Client) RestartDeployment(ctx context.Context, ns, name string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	patch := fmt.Sprintf(`{"spec":{"template":{"metadata":{"annotations":{"deckhand.io/restartedAt":"%s"}}}}}`, time.Now().Format(time.RFC3339))
	_, err := c.clientset.AppsV1().Deployments(ns).Patch(ctx, name, types.StrategicMergePatchType, []byte(patch), metav1.PatchOptions{})
	return err
}

func (c *Client) DeleteDeployment(ctx context.Context, ns, name string) error {
	if err := c.ensureReady(); err != nil {
		return err
	}
	return c.clientset.AppsV1().Deployments(ns).Delete(ctx, name, metav1.DeleteOptions{})
}

func (c *Client) RESTConfig() *rest.Config         { return c.config }
func (c *Client) Clientset() *kubernetes.Clientset { return c.clientset }
