package main

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
)

// whoamiHandler returns the requester's IP address and User-Agent.
// Complexity: Low
func whoamiHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprintf(w, "IP: %s\nUser-Agent: %s", r.RemoteAddr, r.UserAgent())
}

// quadraticHandler solves the quadratic equation ax^2 + bx + c = 0.
// Complexity: Medium
func quadraticHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Only GET method is allowed", http.StatusMethodNotAllowed)
		return
	}

	aStr := r.URL.Query().Get("a")
	bStr := r.URL.Query().Get("b")
	cStr := r.URL.Query().Get("c")

	if aStr == "" || bStr == "" || cStr == "" {
		http.Error(w, "Query parameters 'a', 'b', and 'c' are required", http.StatusBadRequest)
		return
	}

	a, errA := strconv.ParseFloat(aStr, 64)
	b, errB := strconv.ParseFloat(bStr, 64)
	c, errC := strconv.ParseFloat(cStr, 64)

	if errA != nil || errB != nil || errC != nil {
		http.Error(w, "Parameters must be valid numbers", http.StatusBadRequest)
		return
	}

	if a == 0 {
		http.Error(w, "Parameter 'a' cannot be zero for a quadratic equation", http.StatusBadRequest)
		return
	}

	discriminant := b*b - 4*a*c
	w.Header().Set("Content-Type", "application/json")

	if discriminant < 0 {
		json.NewEncoder(w).Encode(map[string]string{"result": "No real roots"})
	} else if discriminant == 0 {
		root := -b / (2 * a)
		json.NewEncoder(w).Encode(map[string]interface{}{"roots": []float64{root}})
	} else {
		root1 := (-b + math.Sqrt(discriminant)) / (2 * a)
		root2 := (-b - math.Sqrt(discriminant)) / (2 * a)
		json.NewEncoder(w).Encode(map[string]interface{}{"roots": []float64{root1, root2}})
	}
}

// KnapsackItem represents an item with weight and value.
type KnapsackItem struct {
	Weight int `json:"weight"`
	Value  int `json:"value"`
}

// KnapsackRequest represents the input for the knapsack problem.
type KnapsackRequest struct {
	Capacity int            `json:"capacity"`
	Items    []KnapsackItem `json:"items"`
}

// knapsackHandler solves the 0/1 Knapsack problem using Dynamic Programming.
// Complexity: High
func knapsackHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Only POST method is allowed", http.StatusMethodNotAllowed)
		return
	}

	var req KnapsackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// dp[w] stores the maximum value that can be attained with capacity w
	dp := make([]int, req.Capacity+1)

	for _, item := range req.Items {
		// Iterate backwards to avoid using the same item multiple times for the same capacity
		for w := req.Capacity; w >= item.Weight; w-- {
			if dp[w-item.Weight]+item.Value > dp[w] {
				dp[w] = dp[w-item.Weight] + item.Value
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"max_value": dp[req.Capacity]})
}
