# Calculate mean and 95% CI for Pre and Post scores
# Both non-adjusted (observed) and adjusted (ANCOVA)

library(car)

# Read the data
control <- read.csv("control.csv", stringsAsFactors = FALSE)
treatment <- read.csv("treatment.csv", stringsAsFactors = FALSE)

# Clean the data - remove percentage signs and convert to numeric
clean_percentage <- function(x) {
  as.numeric(gsub("%", "", x))
}

# Extract data (remove last row if it's a summary)
control_pre <- clean_percentage(control$Correct.pre[1:(nrow(control)-1)])
control_post <- clean_percentage(control$Correct.post[1:(nrow(control)-1)])
control_diff <- clean_percentage(control$Differences[1:(nrow(control)-1)])

treatment_pre <- clean_percentage(treatment$Correct.pre[1:nrow(treatment)])
treatment_post <- clean_percentage(treatment$Correct.post[1:nrow(treatment)])
treatment_diff <- clean_percentage(treatment$Differences[1:nrow(treatment)])

# Function to calculate mean and 95% CI (non-adjusted)
calc_stats <- function(data) {
  n <- length(data)
  mean_val <- mean(data)
  se <- sd(data) / sqrt(n)
  ci_lower <- mean_val - 1.96 * se
  ci_upper <- mean_val + 1.96 * se
  return(list(mean = mean_val, ci_lower = ci_lower, ci_upper = ci_upper, 
              sd = sd(data), n = n))
}

cat("=== NON-ADJUSTED (OBSERVED) MEANS AND 95% CI ===\n\n")

# Non-adjusted statistics
control_pre_obs <- calc_stats(control_pre)
control_post_obs <- calc_stats(control_post)
control_improvement_obs <- calc_stats(control_diff)

treatment_pre_obs <- calc_stats(treatment_pre)
treatment_post_obs <- calc_stats(treatment_post)
treatment_improvement_obs <- calc_stats(treatment_diff)

cat("CONTROL GROUP:\n")
cat(sprintf("  Pre-study:\n"))
cat(sprintf("    Mean: %.2f%%\n", control_pre_obs$mean))
cat(sprintf("    SD: %.2f%%\n", control_pre_obs$sd))
cat(sprintf("    N: %d\n", control_pre_obs$n))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            control_pre_obs$ci_lower, control_pre_obs$ci_upper))

cat(sprintf("\n  Post-study:\n"))
cat(sprintf("    Mean: %.2f%%\n", control_post_obs$mean))
cat(sprintf("    SD: %.2f%%\n", control_post_obs$sd))
cat(sprintf("    N: %d\n", control_post_obs$n))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            control_post_obs$ci_lower, control_post_obs$ci_upper))

cat(sprintf("\n  Improvement (Post - Pre):\n"))
cat(sprintf("    Mean: %.2f%%\n", control_improvement_obs$mean))
cat(sprintf("    SD: %.2f%%\n", control_improvement_obs$sd))
cat(sprintf("    N: %d\n", control_improvement_obs$n))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            control_improvement_obs$ci_lower, control_improvement_obs$ci_upper))

cat("\nTREATMENT GROUP:\n")
cat(sprintf("  Pre-study:\n"))
cat(sprintf("    Mean: %.2f%%\n", treatment_pre_obs$mean))
cat(sprintf("    SD: %.2f%%\n", treatment_pre_obs$sd))
cat(sprintf("    N: %d\n", treatment_pre_obs$n))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            treatment_pre_obs$ci_lower, treatment_pre_obs$ci_upper))

cat(sprintf("\n  Post-study:\n"))
cat(sprintf("    Mean: %.2f%%\n", treatment_post_obs$mean))
cat(sprintf("    SD: %.2f%%\n", treatment_post_obs$sd))
cat(sprintf("    N: %d\n", treatment_post_obs$n))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            treatment_post_obs$ci_lower, treatment_post_obs$ci_upper))

cat(sprintf("\n  Improvement (Post - Pre):\n"))
cat(sprintf("    Mean: %.2f%%\n", treatment_improvement_obs$mean))
cat(sprintf("    SD: %.2f%%\n", treatment_improvement_obs$sd))
cat(sprintf("    N: %d\n", treatment_improvement_obs$n))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            treatment_improvement_obs$ci_lower, treatment_improvement_obs$ci_upper))

# ============================================
# ANCOVA-ADJUSTED MEANS AND CI
# ============================================
cat("\n=== ANCOVA-ADJUSTED MEANS AND 95% CI ===\n\n")
cat("Note: Adjusted means are calculated at the grand mean of pre-scores\n\n")

# Prepare data for ANCOVA
ancova_data <- data.frame(
  Group = factor(c(rep("Control", length(control_pre)), rep("Treatment", length(treatment_pre)))),
  Pre = c(control_pre, treatment_pre),
  Post = c(control_post, treatment_post)
)

# Fit ANCOVA model
ancova_model <- lm(Post ~ Pre + Group, data = ancova_data)
grand_mean_pre <- mean(c(control_pre, treatment_pre))

cat(sprintf("Grand mean of Pre-scores: %.2f%%\n\n", grand_mean_pre))

# Get adjusted means and CI for Post-study
pred_control <- predict(ancova_model, 
                       newdata = data.frame(Group = "Control", Pre = grand_mean_pre),
                       se.fit = TRUE, interval = "confidence")
pred_treatment <- predict(ancova_model,
                         newdata = data.frame(Group = "Treatment", Pre = grand_mean_pre),
                         se.fit = TRUE, interval = "confidence")

# Adjusted statistics
control_pre_adj <- list(mean = grand_mean_pre, ci_lower = grand_mean_pre, ci_upper = grand_mean_pre)
control_post_adj_mean <- as.numeric(pred_control$fit[1])
control_post_adj <- list(mean = control_post_adj_mean,
                         ci_lower = pred_control$fit[1, "lwr"],
                         ci_upper = pred_control$fit[1, "upr"])

treatment_pre_adj <- list(mean = grand_mean_pre, ci_lower = grand_mean_pre, ci_upper = grand_mean_pre)
treatment_post_adj_mean <- as.numeric(pred_treatment$fit[1])
treatment_post_adj <- list(mean = treatment_post_adj_mean,
                           ci_lower = pred_treatment$fit[1, "lwr"],
                           ci_upper = pred_treatment$fit[1, "upr"])

# Calculate adjusted improvement (Post - Pre at grand mean)
control_improvement_adj_mean <- control_post_adj_mean - grand_mean_pre
control_improvement_adj <- list(mean = control_improvement_adj_mean,
                                ci_lower = pred_control$fit[1, "lwr"] - grand_mean_pre,
                                ci_upper = pred_control$fit[1, "upr"] - grand_mean_pre)

treatment_improvement_adj_mean <- treatment_post_adj_mean - grand_mean_pre
treatment_improvement_adj <- list(mean = treatment_improvement_adj_mean,
                                  ci_lower = pred_treatment$fit[1, "lwr"] - grand_mean_pre,
                                  ci_upper = pred_treatment$fit[1, "upr"] - grand_mean_pre)

cat("CONTROL GROUP:\n")
cat(sprintf("  Pre-study (at grand mean):\n"))
cat(sprintf("    Mean: %.2f%%\n", control_pre_adj$mean))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            control_pre_adj$ci_lower, control_pre_adj$ci_upper))

cat(sprintf("\n  Post-study (adjusted):\n"))
cat(sprintf("    Mean: %.2f%%\n", control_post_adj$mean))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            control_post_adj$ci_lower, control_post_adj$ci_upper))

cat(sprintf("\n  Improvement (adjusted Post - adjusted Pre):\n"))
cat(sprintf("    Mean: %.2f%%\n", control_improvement_adj$mean))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            control_improvement_adj$ci_lower, control_improvement_adj$ci_upper))

cat("\nTREATMENT GROUP:\n")
cat(sprintf("  Pre-study (at grand mean):\n"))
cat(sprintf("    Mean: %.2f%%\n", treatment_pre_adj$mean))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            treatment_pre_adj$ci_lower, treatment_pre_adj$ci_upper))

cat(sprintf("\n  Post-study (adjusted):\n"))
cat(sprintf("    Mean: %.2f%%\n", treatment_post_adj$mean))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            treatment_post_adj$ci_lower, treatment_post_adj$ci_upper))

cat(sprintf("\n  Improvement (adjusted Post - adjusted Pre):\n"))
cat(sprintf("    Mean: %.2f%%\n", treatment_improvement_adj$mean))
cat(sprintf("    95%% CI: [%.2f%%, %.2f%%]\n", 
            treatment_improvement_adj$ci_lower, treatment_improvement_adj$ci_upper))

# ============================================
# SUMMARY TABLE
# ============================================
cat("\n=== SUMMARY TABLE ===\n\n")

cat("CONTROL GROUP:\n")
cat("Metric          | Non-adjusted Mean | Non-adjusted 95% CI | Adjusted Mean | Adjusted 95% CI\n")
cat("----------------|-------------------|---------------------|---------------|----------------\n")
cat(sprintf("Pre-study     | %8.2f%%       | [%5.2f%%, %5.2f%%] | %8.2f%%     | [%5.2f%%, %5.2f%%]\n",
            control_pre_obs$mean, control_pre_obs$ci_lower, control_pre_obs$ci_upper,
            control_pre_adj$mean, control_pre_adj$ci_lower, control_pre_adj$ci_upper))
cat(sprintf("Post-study    | %8.2f%%       | [%5.2f%%, %5.2f%%] | %8.2f%%     | [%5.2f%%, %5.2f%%]\n",
            control_post_obs$mean, control_post_obs$ci_lower, control_post_obs$ci_upper,
            control_post_adj$mean, control_post_adj$ci_lower, control_post_adj$ci_upper))
cat(sprintf("Improvement   | %8.2f%%       | [%5.2f%%, %5.2f%%] | %8.2f%%     | [%5.2f%%, %5.2f%%]\n",
            control_improvement_obs$mean, control_improvement_obs$ci_lower, control_improvement_obs$ci_upper,
            control_improvement_adj$mean, control_improvement_adj$ci_lower, control_improvement_adj$ci_upper))

cat("\nTREATMENT GROUP:\n")
cat("Metric          | Non-adjusted Mean | Non-adjusted 95% CI | Adjusted Mean | Adjusted 95% CI\n")
cat("----------------|-------------------|---------------------|---------------|----------------\n")
cat(sprintf("Pre-study     | %8.2f%%       | [%5.2f%%, %5.2f%%] | %8.2f%%     | [%5.2f%%, %5.2f%%]\n",
            treatment_pre_obs$mean, treatment_pre_obs$ci_lower, treatment_pre_obs$ci_upper,
            treatment_pre_adj$mean, treatment_pre_adj$ci_lower, treatment_pre_adj$ci_upper))
cat(sprintf("Post-study    | %8.2f%%       | [%5.2f%%, %5.2f%%] | %8.2f%%     | [%5.2f%%, %5.2f%%]\n",
            treatment_post_obs$mean, treatment_post_obs$ci_lower, treatment_post_obs$ci_upper,
            treatment_post_adj$mean, treatment_post_adj$ci_lower, treatment_post_adj$ci_upper))
cat(sprintf("Improvement   | %8.2f%%       | [%5.2f%%, %5.2f%%] | %8.2f%%     | [%5.2f%%, %5.2f%%]\n",
            treatment_improvement_obs$mean, treatment_improvement_obs$ci_lower, treatment_improvement_obs$ci_upper,
            treatment_improvement_adj$mean, treatment_improvement_adj$ci_lower, treatment_improvement_adj$ci_upper))

# Save results to CSV for easy reference
results_df <- data.frame(
  Group = rep(c("Control", "Treatment"), each = 3),
  Metric = rep(c("Pre-study", "Post-study", "Improvement"), 2),
  NonAdjusted_Mean = c(control_pre_obs$mean, control_post_obs$mean, control_improvement_obs$mean,
                       treatment_pre_obs$mean, treatment_post_obs$mean, treatment_improvement_obs$mean),
  NonAdjusted_CI_Lower = c(control_pre_obs$ci_lower, control_post_obs$ci_lower, control_improvement_obs$ci_lower,
                           treatment_pre_obs$ci_lower, treatment_post_obs$ci_lower, treatment_improvement_obs$ci_lower),
  NonAdjusted_CI_Upper = c(control_pre_obs$ci_upper, control_post_obs$ci_upper, control_improvement_obs$ci_upper,
                           treatment_pre_obs$ci_upper, treatment_post_obs$ci_upper, treatment_improvement_obs$ci_upper),
  Adjusted_Mean = c(control_pre_adj$mean, control_post_adj$mean, control_improvement_adj$mean,
                    treatment_pre_adj$mean, treatment_post_adj$mean, treatment_improvement_adj$mean),
  Adjusted_CI_Lower = c(control_pre_adj$ci_lower, control_post_adj$ci_lower, control_improvement_adj$ci_lower,
                        treatment_pre_adj$ci_lower, treatment_post_adj$ci_lower, treatment_improvement_adj$ci_lower),
  Adjusted_CI_Upper = c(control_pre_adj$ci_upper, control_post_adj$ci_upper, control_improvement_adj$ci_upper,
                        treatment_pre_adj$ci_upper, treatment_post_adj$ci_upper, treatment_improvement_adj$ci_upper)
)

write.csv(results_df, "means_ci_results.csv", row.names = FALSE)
cat("\n\nResults saved to 'means_ci_results.csv'\n")
