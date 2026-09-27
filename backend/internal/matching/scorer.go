// Package matching implements the Opportunity Value (OV) scoring algorithm
// and background worker for the matchmaking engine.
//
// # OV Algorithm Design
//
// The Opportunity Value is a weighted composite score (0.0000 to ~1.5000)
// that measures how well a flat pin matches a seeker's preferences.
// It can exceed 1.0 when the flat represents an upgrade over the seeker's
// current living situation (the "Lifestyle Upgrade" bonus).
//
// ## Score Components
//
//	Component       Weight   Range      Description
//	─────────────   ──────   ──────     ───────────────────────────────────
//	Distance        0.25     0.0-1.0    Proximity to seeker's desired location
//	Budget          0.35     0.0-1.0    How well rent fits the seeker's budget
//	Furnishing      0.20     0.0-1.0    Whether furnishing meets/exceeds minimum
//	Transit         0.20     0.0-1.0    Commute improvement (requires baseline)
//
// ## Upgrade Bonuses
//
//	If the flat represents a furnishing upgrade:  +0.10
//	If the flat shortens commute:                 +0.15
//	If net-positive overall:                      +0.10
//
// Maximum theoretical OV: 1.0 + 0.35 = 1.35
package matching

import (
	"math"

	"pune-flats/backend/internal/model"
	"pune-flats/backend/internal/repository"
)

// Score component weights (must sum to 1.0)
const (
	WeightDistance   = 0.25
	WeightBudget    = 0.35
	WeightFurnishing = 0.20
	WeightTransit   = 0.20
)

// Upgrade bonuses
const (
	BonusFurnishingUpgrade = 0.10
	BonusCommuteUpgrade    = 0.15
	BonusNetPositive       = 0.10
)

// furnishingRank maps furnishing levels to numeric ranks for comparison.
var furnishingRank = map[string]int{
	"UNFURNISHED":      0,
	"SEMI_FURNISHED":   1,
	"FULLY_FURNISHED":  2,
	"LUXURY_FURNISHED": 3,
}

// OVResult holds the computed OV score and its components.
type OVResult struct {
	OpportunityValue float64
	DistanceScore    float64
	BudgetScore      float64
	FurnishingScore  float64
	TransitScore     *float64

	IsFurnishingUpgrade bool
	IsCommuteUpgrade    bool
	IsNetPositive       bool
}

// CalculateOV computes the Opportunity Value for a seeker-flat pair.
//
// Arguments:
//   - seeker: the seeker pin with preferences
//   - candidate: the flat pin with pre-computed distance
//   - baseline: optional user baseline for upgrade detection (nil = no baseline)
func CalculateOV(seeker *model.SeekerPin, candidate *model.MatchCandidate, baseline *repository.UserBaseline) OVResult {
	result := OVResult{}

	// -----------------------------------------------------------------------
	// 1. Distance Score (0.0 = at max radius, 1.0 = right on top)
	// -----------------------------------------------------------------------
	distKM := candidate.DistanceMeters / 1000.0
	radiusKM := seeker.SearchRadiusKM
	if radiusKM <= 0 {
		radiusKM = 5.0 // fallback
	}
	// Linear decay: 1.0 at center, 0.0 at edge
	result.DistanceScore = math.Max(0, 1.0-(distKM/radiusKM))

	// -----------------------------------------------------------------------
	// 2. Budget Score (0.0 = way over budget, 1.0 = perfect fit)
	// -----------------------------------------------------------------------
	result.BudgetScore = scoreBudget(seeker, candidate.Rent)

	// -----------------------------------------------------------------------
	// 3. Furnishing Score (0.0 = below minimum, 1.0 = meets or exceeds)
	// -----------------------------------------------------------------------
	result.FurnishingScore = scoreFurnishing(seeker.FurnishingMin, candidate.Furnishing)

	// -----------------------------------------------------------------------
	// 4. Transit Score (0.0-1.0, only if baseline has commute data)
	// -----------------------------------------------------------------------
	if baseline != nil && baseline.CurrentCommuteKM != nil && *baseline.CurrentCommuteKM > 0 {
		transitScore := scoreTransit(baseline, candidate.DistanceMeters)
		result.TransitScore = &transitScore
	}

	// -----------------------------------------------------------------------
	// Composite OV Score (weighted sum)
	// -----------------------------------------------------------------------
	ov := result.DistanceScore*WeightDistance +
		result.BudgetScore*WeightBudget +
		result.FurnishingScore*WeightFurnishing

	if result.TransitScore != nil {
		ov += *result.TransitScore * WeightTransit
	} else {
		// Redistribute transit weight proportionally to other components
		redistributed := WeightTransit / (WeightDistance + WeightBudget + WeightFurnishing)
		ov = result.DistanceScore*(WeightDistance+WeightDistance*redistributed) +
			result.BudgetScore*(WeightBudget+WeightBudget*redistributed) +
			result.FurnishingScore*(WeightFurnishing+WeightFurnishing*redistributed)
	}

	// -----------------------------------------------------------------------
	// Upgrade Bonuses (Lifestyle Upgrade Engine)
	// -----------------------------------------------------------------------
	if baseline != nil {
		// Furnishing upgrade: flat furnishing exceeds baseline
		flatRank := furnishingRank[candidate.Furnishing]
		baseRank := furnishingRank[baseline.CurrentFurnishing]
		if flatRank > baseRank {
			result.IsFurnishingUpgrade = true
			ov += BonusFurnishingUpgrade
		}

		// Commute upgrade: new location shortens commute
		if baseline.CurrentCommuteKM != nil && *baseline.CurrentCommuteKM > 0 {
			// Rough estimate: is the flat closer to their workplace than their current home?
			// Full implementation would use actual commute_destination point,
			// but for MVP we use the distance from seeker pin to flat pin as proxy.
			newCommuteKM := candidate.DistanceMeters / 1000.0
			if newCommuteKM < *baseline.CurrentCommuteKM {
				result.IsCommuteUpgrade = true
				ov += BonusCommuteUpgrade
			}
		}

		// Net positive: the match is an overall upgrade
		// Budget savings + furnishing upgrade + commute improvement
		budgetSavings := baseline.CurrentRent - candidate.Rent
		upgrades := 0
		if result.IsFurnishingUpgrade {
			upgrades++
		}
		if result.IsCommuteUpgrade {
			upgrades++
		}
		if budgetSavings > 0 {
			upgrades++
		}
		if upgrades >= 2 || (upgrades >= 1 && budgetSavings >= 0) {
			result.IsNetPositive = true
			ov += BonusNetPositive
		}
	}

	// Clamp to 4 decimal places
	result.OpportunityValue = math.Round(ov*10000) / 10000

	return result
}

// scoreBudget calculates the budget compatibility score.
//
// Scoring logic:
//   - If rent <= budget_min (seeker's minimum): perfect score (might be too cheap = suspicious)
//     Actually no, that's still great for the seeker. Score 1.0.
//   - If rent is between budget_min and budget_max: linearly scaled based on how close to min
//   - If rent > budget_max: score decays rapidly (but non-zero for small overages)
func scoreBudget(seeker *model.SeekerPin, rent float64) float64 {
	budgetMax := seeker.BudgetMax
	budgetMin := 0.0
	if seeker.BudgetMin != nil {
		budgetMin = *seeker.BudgetMin
	}

	if budgetMax <= 0 {
		return 0
	}

	// At or below the seeker's minimum: perfect score
	if rent <= budgetMin {
		return 1.0
	}

	// Within budget range: linear interpolation (closer to min = higher score)
	if rent <= budgetMax {
		if budgetMax == budgetMin {
			return 1.0 // Exact match
		}
		// 1.0 at budgetMin, 0.6 at budgetMax (still a reasonable match)
		return 1.0 - 0.4*((rent-budgetMin)/(budgetMax-budgetMin))
	}

	// Over budget: rapid exponential decay
	overage := (rent - budgetMax) / budgetMax
	return math.Max(0, 0.6*math.Exp(-5*overage))
}

// scoreFurnishing calculates whether the flat meets the seeker's minimum requirement.
//
// Scoring logic:
//   - Below minimum: 0.0 to 0.3 (penalized but not zero)
//   - Meets minimum: 0.8
//   - Exceeds minimum: 0.8 + bonus up to 1.0
func scoreFurnishing(seekerMin, flatFurnishing string) float64 {
	seekerRank := furnishingRank[seekerMin]
	flatRank := furnishingRank[flatFurnishing]

	diff := flatRank - seekerRank

	switch {
	case diff < -1:
		return 0.1 // Way below minimum
	case diff == -1:
		return 0.3 // One level below
	case diff == 0:
		return 0.8 // Meets minimum exactly
	case diff == 1:
		return 0.9 // One level above
	default:
		return 1.0 // Two or more levels above
	}
}

// scoreTransit estimates how a flat improves the seeker's commute.
// This is a simplified model; a full implementation would query the
// commute_destination point and use ST_Distance.
//
// For MVP: uses the distance between seeker pin center and flat pin
// as a proxy for commute change.
func scoreTransit(baseline *repository.UserBaseline, distanceMeters float64) float64 {
	if baseline.CurrentCommuteKM == nil || *baseline.CurrentCommuteKM <= 0 {
		return 0.5 // Neutral
	}

	currentKM := *baseline.CurrentCommuteKM
	flatDistKM := distanceMeters / 1000.0

	// If the flat is closer to where they work (approximation),
	// the score is higher.
	// 1.0 = cuts commute in half or more, 0.5 = same, 0.0 = doubles it
	ratio := flatDistKM / currentKM
	if ratio <= 0.5 {
		return 1.0
	}
	if ratio >= 2.0 {
		return 0.0
	}
	// Linear interpolation between 0.5 and 2.0
	return 1.0 - (ratio-0.5)/1.5
}

// ContainsBHK checks if the seeker's BHK preference list includes the flat's BHK.
func ContainsBHK(seekerBHKs []string, flatBHK string) bool {
	for _, b := range seekerBHKs {
		if b == flatBHK {
			return true
		}
	}
	return false
}

// ContainsPropertyType checks if the seeker's property type list includes the flat's type.
func ContainsPropertyType(seekerTypes []string, flatType string) bool {
	for _, t := range seekerTypes {
		if t == flatType {
			return true
		}
	}
	return false
}
