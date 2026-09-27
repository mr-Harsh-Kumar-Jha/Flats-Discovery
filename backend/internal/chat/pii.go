// Package chat implements the real-time chat system including
// WebSocket hub, PII detection, and message delivery.
package chat

import (
	"regexp"
	"strings"
)

// PIIResult holds the outcome of a PII scan on a message.
type PIIResult struct {
	HasPII          bool
	ScrubbedContent string
	Patterns        []string // e.g. ["phone", "email"]
}

// Compiled regex patterns for PII detection.
// These are intentionally aggressive — false positives are acceptable
// because trust is a core feature. Users are warned in the UI.
var (
	// Indian phone numbers:
	//   +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX (10 digits)
	//   Also catches numbers with spaces/dashes: +91 98765 43210, +91-9876-543-210
	rePhone = regexp.MustCompile(
		`(?:(?:\+?91[\s\-]?)|(?:0))?\d[\d\s\-]{8,12}\d`,
	)

	// Email addresses: standard pattern
	reEmail = regexp.MustCompile(
		`[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}`,
	)

	// WhatsApp / social media handles
	// Catches: "whatsapp me", "my insta is", "telegram @handle", etc.
	reSocial = regexp.MustCompile(
		`(?i)(?:whatsapp|telegram|signal|insta(?:gram)?|fb|facebook|snapchat|twitter|x\.com)\s*(?:[:@]\s*)?[a-zA-Z0-9._]{2,30}`,
	)

	// URLs (potential redirect to contact info)
	reURL = regexp.MustCompile(
		`https?://[^\s]{5,}`,
	)

	// Explicit number sharing patterns: "call me on", "reach me at", "contact", "number is"
	reExplicitShare = regexp.MustCompile(
		`(?i)(?:call|reach|contact|number|phone|mobile|cell)\s*(?:me\s+)?(?:on|at|is|:)\s*\d`,
	)
)

// redactionText is the placeholder used to replace PII.
const redactionText = "[REDACTED]"

// ScrubPII scans a message for personally identifiable information
// and returns the scrubbed version with detection metadata.
//
// The scrubbing is applied in priority order:
//  1. Emails (most distinctive pattern)
//  2. Social media handles
//  3. URLs
//  4. Phone numbers (most common PII leak in Indian rental markets)
//
// The original message is never modified — a new string is returned.
func ScrubPII(message string) PIIResult {
	result := PIIResult{
		ScrubbedContent: message,
	}

	patterns := []struct {
		name    string
		pattern *regexp.Regexp
	}{
		{"email", reEmail},
		{"social_media", reSocial},
		{"url", reURL},
		{"phone", rePhone},
	}

	seen := make(map[string]bool)

	for _, p := range patterns {
		if p.pattern.MatchString(result.ScrubbedContent) {
			result.ScrubbedContent = p.pattern.ReplaceAllString(result.ScrubbedContent, redactionText)
			if !seen[p.name] {
				result.Patterns = append(result.Patterns, p.name)
				seen[p.name] = true
			}
			result.HasPII = true
		}
	}

	// Also check for explicit sharing attempts (flag but don't scrub — the
	// actual number will already be caught by rePhone)
	if reExplicitShare.MatchString(message) && !seen["explicit_share"] {
		result.Patterns = append(result.Patterns, "explicit_share")
		result.HasPII = true
	}

	// Collapse multiple consecutive [REDACTED] markers
	for strings.Contains(result.ScrubbedContent, redactionText+" "+redactionText) {
		result.ScrubbedContent = strings.ReplaceAll(
			result.ScrubbedContent,
			redactionText+" "+redactionText,
			redactionText,
		)
	}

	return result
}
