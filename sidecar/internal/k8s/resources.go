package k8s

import (
	"context"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (c *Client) ListServices(ctx context.Context, ns string) ([]corev1.Service, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().Services(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListIngresses(ctx context.Context, ns string) ([]networkingv1.Ingress, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.NetworkingV1().Ingresses(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListConfigMaps(ctx context.Context, ns string) ([]corev1.ConfigMap, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().ConfigMaps(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

// SecretSummary redacts data values for E-lite.
type SecretSummary struct {
	Name      string            `json:"name"`
	Namespace string            `json:"namespace"`
	Type      string            `json:"type"`
	Keys      []string          `json:"keys"`
	Labels    map[string]string `json:"labels,omitempty"`
	Created   string            `json:"created,omitempty"`
}

func (c *Client) ListSecrets(ctx context.Context, ns string) ([]SecretSummary, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().Secrets(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]SecretSummary, 0, len(list.Items))
	for _, s := range list.Items {
		keys := make([]string, 0, len(s.Data))
		for k := range s.Data {
			keys = append(keys, k)
		}
		created := ""
		if !s.CreationTimestamp.IsZero() {
			created = s.CreationTimestamp.Time.Format(time.RFC3339)
		}
		out = append(out, SecretSummary{
			Name: s.Name, Namespace: s.Namespace, Type: string(s.Type),
			Keys: keys, Labels: s.Labels, Created: created,
		})
	}
	return out, nil
}

func (c *Client) ListNodes(ctx context.Context) ([]corev1.Node, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListEvents(ctx context.Context, ns string) ([]corev1.Event, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.CoreV1().Events(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListJobs(ctx context.Context, ns string) ([]batchv1.Job, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.BatchV1().Jobs(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListCronJobs(ctx context.Context, ns string) ([]batchv1.CronJob, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.BatchV1().CronJobs(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}

func (c *Client) ListStatefulSets(ctx context.Context, ns string) ([]appsv1.StatefulSet, error) {
	if err := c.ensureReady(); err != nil {
		return nil, err
	}
	list, err := c.clientset.AppsV1().StatefulSets(ns).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}
	return list.Items, nil
}
