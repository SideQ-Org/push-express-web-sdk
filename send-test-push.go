//go:build ignore
// +build ignore

// Отправляет тестовый Web Push на указанную подписку.
// Использование: go run send-test-push.go <subscription_json>
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	webpush "github.com/SherClockHolmes/webpush-go"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: go run send-test-push.go '<subscription_json>'\n")
		os.Exit(1)
	}

	subJSON := os.Args[1]
	sub := &webpush.Subscription{}
	if err := json.Unmarshal([]byte(subJSON), sub); err != nil {
		fmt.Fprintf(os.Stderr, "bad subscription JSON: %v\n", err)
		os.Exit(1)
	}

	payload, _ := json.Marshal(map[string]string{
		"title":  "E2E Test Push",
		"body":   "Hello from push-service backend!",
		"msg_id": "e2e-test-001",
	})

	resp, err := webpush.SendNotification(payload, sub, &webpush.Options{
		VAPIDPublicKey:  "BIzf_JF3HUE8hTREgY44O4IGx-cGgaLib5f2WFPTi-tZFIXeHBev3BeTq8y8L47W3jseDCpJTgD3uyiu0a1UwMQ",
		VAPIDPrivateKey: "xYAZhvlcK1jUa3sQrk-DGVC6BD_JU0dEnsQshnTfbLc",
		Subscriber:      "mailto:admin@pushexpress.com",
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "send error: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("Status: %d\nBody: %s\n", resp.StatusCode, string(body))

	if resp.StatusCode == 201 || resp.StatusCode == 200 {
		fmt.Println("Push delivered to FCM!")
	} else {
		fmt.Println("Push delivery failed")
		os.Exit(1)
	}
}
