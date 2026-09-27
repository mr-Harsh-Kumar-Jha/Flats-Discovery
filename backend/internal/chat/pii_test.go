package chat

import (
	"testing"
)

func TestScrubPII_PhoneNumbers(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		wantPII  bool
		wantPats []string
	}{
		{
			name:     "Indian mobile +91",
			input:    "Call me on +919876543210",
			wantPII:  true,
			wantPats: []string{"phone"},
		},
		{
			name:     "Indian mobile with spaces",
			input:    "My number is +91 98765 43210",
			wantPII:  true,
			wantPats: []string{"phone"},
		},
		{
			name:     "10 digit number",
			input:    "Reach me at 9876543210",
			wantPII:  true,
			wantPats: []string{"phone", "explicit_share"},
		},
		{
			name:     "Number with dashes",
			input:    "Contact: 098-765-43210",
			wantPII:  true,
			wantPats: []string{"phone"},
		},
		{
			name:    "Clean message",
			input:   "I am interested in the flat. When can I visit?",
			wantPII: false,
		},
		{
			name:    "Budget discussion (not PII)",
			input:   "Can you do 15000 per month?",
			wantPII: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ScrubPII(tt.input)
			if result.HasPII != tt.wantPII {
				t.Errorf("HasPII = %v, want %v (input: %q, scrubbed: %q)", result.HasPII, tt.wantPII, tt.input, result.ScrubbedContent)
			}
			if result.HasPII && tt.wantPats != nil {
				for _, pat := range tt.wantPats {
					found := false
					for _, p := range result.Patterns {
						if p == pat {
							found = true
							break
						}
					}
					if !found {
						t.Errorf("expected pattern %q not found in %v", pat, result.Patterns)
					}
				}
			}
			if result.HasPII {
				if result.ScrubbedContent == tt.input {
					t.Error("scrubbed content should differ from original when PII detected")
				}
				t.Logf("  Scrubbed: %q", result.ScrubbedContent)
			}
		})
	}
}

func TestScrubPII_Emails(t *testing.T) {
	result := ScrubPII("Email me at harsh.kumar@gmail.com for details")
	if !result.HasPII {
		t.Error("should detect email")
	}
	if len(result.Patterns) == 0 || result.Patterns[0] != "email" {
		t.Errorf("first pattern should be 'email', got %v", result.Patterns)
	}
	t.Logf("Scrubbed: %q", result.ScrubbedContent)
}

func TestScrubPII_SocialMedia(t *testing.T) {
	tests := []struct {
		input   string
		wantPII bool
	}{
		{"My whatsapp: harsh_k", true},
		{"DM me on instagram @flatowner", true},
		{"Find me on telegram @harsh123", true},
		{"Let's discuss the flat details", false},
	}

	for _, tt := range tests {
		result := ScrubPII(tt.input)
		if result.HasPII != tt.wantPII {
			t.Errorf("input %q: HasPII = %v, want %v", tt.input, result.HasPII, tt.wantPII)
		}
	}
}

func TestScrubPII_URLs(t *testing.T) {
	result := ScrubPII("Check my listing at https://example.com/flat/123")
	if !result.HasPII {
		t.Error("should detect URL")
	}
	t.Logf("Scrubbed: %q", result.ScrubbedContent)
}

func TestScrubPII_MixedPII(t *testing.T) {
	result := ScrubPII("Call me at 9876543210 or email harsh@test.com for the flat")
	if !result.HasPII {
		t.Fatal("should detect mixed PII")
	}
	if len(result.Patterns) < 2 {
		t.Errorf("should detect at least 2 patterns, got %v", result.Patterns)
	}
	t.Logf("Patterns: %v", result.Patterns)
	t.Logf("Scrubbed: %q", result.ScrubbedContent)
}
