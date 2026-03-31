# Power Analysis: Sample size and effect size needed for statistical significance
# For comparing Treatment vs Control groups

library(pwr)

# Read the data
control <- read.csv("control.csv", stringsAsFactors = FALSE)
treatment <- read.csv("treatment.csv", stringsAsFactors = FALSE)

# Clean the data
clean_percentage <- function(x) {
  as.numeric(gsub("%", "", x))
}

control_diff <- clean_percentage(control$Differences[1:(nrow(control)-1)])
treatment_diff <- clean_percentage(treatment$Differences[1:nrow(treatment)])

# Current statistics
n_current <- length(control_diff)
mean_control <- mean(control_diff)
mean_treatment <- mean(treatment_diff)
sd_control <- sd(control_diff)
sd_treatment <- sd(treatment_diff)

# Pooled standard deviation
pooled_sd <- sqrt(((n_current - 1) * sd_control^2 + (n_current - 1) * sd_treatment^2) / 
                  (2 * n_current - 2))

# Current effect size (Cohen's d)
current_d <- (mean_treatment - mean_control) / pooled_sd
current_diff <- mean_treatment - mean_control

# Calculate Cohen's f for ANOVA (for two groups: f = d/2)
current_f <- current_d / 2

cat("=== CURRENT SITUATION ===\n\n")
cat(sprintf("Current sample size per group: %d\n", n_current))
cat(sprintf("Current mean difference: %.2f%%\n", current_diff))
cat(sprintf("Current Cohen's d: %.4f\n", current_d))
cat(sprintf("Current Cohen's f (for ANOVA): %.4f\n", cux crrent_f))
cat(sprintf("Control SD: %.2f%%\n", sd_control))
cat(sprintf("Treatment SD: %.2f%%\n", sd_treatment))
cat(sprintf("Pooled SD: %.2f%%\n", pooled_sd))

# ============================================
# POWER ANALYSIS: Sample size needed
# ============================================
cat("\n=== SAMPLE SIZE NEEDED FOR SIGNIFICANCE ===\n\n")
cat("Assuming current effect size (d = ", sprintf("%.4f", current_d), ")\n\n")

# For t-test (two-tailed, alpha = 0.05, power = 0.80)
power_target <- 0.80
alpha <- 0.05

# Two-tailed t-test
pwr_result_2t <- pwr.t.test(d = current_d, 
                            sig.level = alpha, 
                            power = power_target,
                            type = "two.sample",
                            alternative = "two.sided")

cat("1. TWO-TAILED T-TEST:\n")
cat(sprintf("   Power = %.0f%%, Alpha = %.2f\n", power_target * 100, alpha))
cat(sprintf("   Sample size per group needed: %.0f\n", ceiling(pwr_result_2t$n)))
cat(sprintf("   Total sample size needed: %.0f\n", ceiling(pwr_result_2t$n) * 2))
cat(sprintf("   Additional participants needed: %.0f per group\n", 
            ceiling(pwr_result_2t$n) - n_current))

# One-tailed t-test
pwr_result_1t <- pwr.t.test(d = current_d, 
                            sig.level = alpha, 
                            power = power_target,
                            type = "two.sample",
                            alternative = "greater")

cat("\n2. ONE-TAILED T-TEST (Treatment > Control):\n")
cat(sprintf("   Power = %.0f%%, Alpha = %.2f\n", power_target * 100, alpha))
cat(sprintf("   Sample size per group needed: %.0f\n", ceiling(pwr_result_1t$n)))
cat(sprintf("   Total sample size needed: %.0f\n", ceiling(pwr_result_1t$n) * 2))
cat(sprintf("   Additional participants needed: %.0f per group\n", 
            ceiling(pwr_result_1t$n) - n_current))

# For Wilcoxon test (using approximation)
# Note: Wilcoxon test power is similar to t-test for moderate effect sizes
cat("\n3. WILCOXON TEST (non-parametric):\n")
cat("   Note: Sample size requirements are similar to t-test\n")
cat(sprintf("   Estimated sample size per group: %.0f\n", ceiling(pwr_result_2t$n)))

# One-way ANOVA (2 groups)
pwr_anova <- pwr.anova.test(k = 2,  # 2 groups
                            f = current_f,
                            sig.level = alpha,
                            power = power_target)

cat("\n4. ONE-WAY ANOVA (2 groups):\n")
cat(sprintf("   Power = %.0f%%, Alpha = %.2f\n", power_target * 100, alpha))
cat(sprintf("   Sample size per group needed: %.0f\n", ceiling(pwr_anova$n)))
cat(sprintf("   Total sample size needed: %.0f\n", ceiling(pwr_anova$n) * 2))
cat(sprintf("   Additional participants needed: %.0f per group\n", 
            ceiling(pwr_anova$n) - n_current))
cat(sprintf("   Cohen's f = %.4f\n", current_f))

# ============================================
# EFFECT SIZE NEEDED FOR SIGNIFICANCE
# ============================================
cat("\n=== EFFECT SIZE NEEDED FOR SIGNIFICANCE ===\n\n")
cat(sprintf("With current sample size (n = %d per group)\n\n", n_current))

# Two-tailed: what effect size is needed?
pwr_effect_2t <- pwr.t.test(n = n_current,
                            sig.level = alpha,
                            power = power_target,
                            type = "two.sample",
                            alternative = "two.sided")

cat("1. TWO-TAILED T-TEST:\n")
cat(sprintf("   Minimum Cohen's d needed: %.4f\n", pwr_effect_2t$d))
cat(sprintf("   Minimum mean difference needed: %.2f%%\n", pwr_effect_2t$d * pooled_sd))
cat(sprintf("   Current difference: %.2f%%\n", current_diff))
cat(sprintf("   Gap: %.2f%%\n", (pwr_effect_2t$d * pooled_sd) - current_diff))

# One-tailed: what effect size is needed?
pwr_effect_1t <- pwr.t.test(n = n_current,
                            sig.level = alpha,
                            power = power_target,
                            type = "two.sample",
                            alternative = "greater")

cat("\n2. ONE-TAILED T-TEST:\n")
cat(sprintf("   Minimum Cohen's d needed: %.4f\n", pwr_effect_1t$d))
cat(sprintf("   Minimum mean difference needed: %.2f%%\n", pwr_effect_1t$d * pooled_sd))
cat(sprintf("   Current difference: %.2f%%\n", current_diff))
cat(sprintf("   Gap: %.2f%%\n", (pwr_effect_1t$d * pooled_sd) - current_diff))

# ANOVA: what effect size (f) is needed?
pwr_effect_anova <- pwr.anova.test(k = 2,
                                    n = n_current,
                                    sig.level = alpha,
                                    power = power_target)

cat("\n3. ONE-WAY ANOVA:\n")
cat(sprintf("   Minimum Cohen's f needed: %.4f\n", pwr_effect_anova$f))
cat(sprintf("   Minimum Cohen's d needed (equivalent): %.4f\n", pwr_effect_anova$f * 2))
cat(sprintf("   Minimum mean difference needed: %.2f%%\n", pwr_effect_anova$f * 2 * pooled_sd))
cat(sprintf("   Current difference: %.2f%%\n", current_diff))
cat(sprintf("   Current Cohen's f: %.4f\n", current_f))
cat(sprintf("   Gap: %.2f%%\n", (pwr_effect_anova$f * 2 * pooled_sd) - current_diff))

# ============================================
# POWER AT CURRENT SAMPLE SIZE
# ============================================
cat("\n=== CURRENT POWER (Probability of detecting effect) ===\n\n")

# Two-tailed power
pwr_current_2t <- pwr.t.test(n = n_current,
                             d = current_d,
                             sig.level = alpha,
                             type = "two.sample",
                             alternative = "two.sided")

cat("1. TWO-TAILED T-TEST:\n")
cat(sprintf("   Current power: %.2f%%\n", pwr_current_2t$power * 100))
cat(sprintf("   Probability of Type II error: %.2f%%\n", (1 - pwr_current_2t$power) * 100))

# One-tailed power
pwr_current_1t <- pwr.t.test(n = n_current,
                             d = current_d,
                             sig.level = alpha,
                             type = "two.sample",
                             alternative = "greater")

cat("\n2. ONE-TAILED T-TEST:\n")
cat(sprintf("   Current power: %.2f%%\n", pwr_current_1t$power * 100))
cat(sprintf("   Probability of Type II error: %.2f%%\n", (1 - pwr_current_1t$power) * 100))

# ANOVA power at current sample size
pwr_current_anova <- pwr.anova.test(k = 2,
                                     n = n_current,
                                     f = current_f,
                                     sig.level = alpha)

cat("\n3. ONE-WAY ANOVA:\n")
cat(sprintf("   Current power: %.2f%%\n", pwr_current_anova$power * 100))
cat(sprintf("   Probability of Type II error: %.2f%%\n", (1 - pwr_current_anova$power) * 100))
cat(sprintf("   Cohen's f = %.4f\n", current_f))

# ============================================
# SCENARIO ANALYSIS: Different sample sizes
# ============================================
cat("\n=== SCENARIO ANALYSIS: Power at different sample sizes ===\n\n")
cat("Assuming current effect size (d = ", sprintf("%.4f", current_d), ")\n\n")

sample_sizes <- c(20, 25, 30, 40, 50, 60, 80, 100)
cat("Sample Size | Two-tailed Power | One-tailed Power | ANOVA Power\n")
cat("------------|------------------|------------------|------------\n")

for (n in sample_sizes) {
  pwr_2t <- pwr.t.test(n = n, d = current_d, sig.level = alpha,
                       type = "two.sample", alternative = "two.sided")
  pwr_1t <- pwr.t.test(n = n, d = current_d, sig.level = alpha,
                       type = "two.sample", alternative = "greater")
  pwr_anova_n <- pwr.anova.test(k = 2, n = n, f = current_f, sig.level = alpha)
  cat(sprintf("     %3d     |      %.2f%%       |      %.2f%%       |    %.2f%%\n",
              n, pwr_2t$power * 100, pwr_1t$power * 100, pwr_anova_n$power * 100))
}

# ============================================
# MINIMUM SAMPLE SIZE FOR VARIOUS EFFECT SIZES
# ============================================
cat("\n=== MINIMUM SAMPLE SIZE FOR DIFFERENT EFFECT SIZES ===\n\n")
cat("(Power = 80%%, Alpha = 0.05)\n\n")

effect_sizes <- c(0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8)
cat("T-TEST (Two-tailed):\n")
cat("Cohen's d | Sample Size/Group | Total Sample | Mean Diff Needed\n")
cat("----------|-------------------|--------------|-----------------\n")

for (d in effect_sizes) {
  pwr_d <- pwr.t.test(d = d, sig.level = alpha, power = power_target,
                      type = "two.sample", alternative = "two.sided")
  mean_diff_needed <- d * pooled_sd
  cat(sprintf("   %.2f   |        %3.0f        |      %3.0f     |      %.2f%%\n",
              d, ceiling(pwr_d$n), ceiling(pwr_d$n) * 2, mean_diff_needed))
}

cat("\nANOVA:\n")
cat("Cohen's f | Sample Size/Group | Total Sample | Mean Diff Needed (d=2f)\n")
cat("----------|-------------------|--------------|------------------------\n")

for (d in effect_sizes) {
  f <- d / 2  # Convert Cohen's d to f for ANOVA
  pwr_f <- pwr.anova.test(k = 2, f = f, sig.level = alpha, power = power_target)
  mean_diff_needed <- d * pooled_sd
  cat(sprintf("   %.2f   |        %3.0f        |      %3.0f     |      %.2f%%\n",
              f, ceiling(pwr_f$n), ceiling(pwr_f$n) * 2, mean_diff_needed))
}

cat("\nNote: Mean difference needed assumes pooled SD = ", sprintf("%.2f%%", pooled_sd), "\n")
cat("Note: For ANOVA, Cohen's f = Cohen's d / 2 (for two groups)\n")

# ============================================
# SUMMARY AND RECOMMENDATIONS
# ============================================
cat("\n=== SUMMARY AND RECOMMENDATIONS ===\n\n")

cat("To achieve statistical significance (p < 0.05) with 80%% power:\n\n")

cat("OPTION 1: Increase sample size (keeping current effect size)\n")
cat(sprintf("  - Two-tailed t-test: Need %.0f participants per group (total: %.0f)\n",
            ceiling(pwr_result_2t$n), ceiling(pwr_result_2t$n) * 2))
cat(sprintf("  - One-tailed t-test: Need %.0f participants per group (total: %.0f)\n",
            ceiling(pwr_result_1t$n), ceiling(pwr_result_1t$n) * 2))
cat(sprintf("  - One-way ANOVA: Need %.0f participants per group (total: %.0f)\n",
            ceiling(pwr_anova$n), ceiling(pwr_anova$n) * 2))
cat(sprintf("  - Current: %d per group (total: %d)\n", n_current, n_current * 2))

cat("\nOPTION 2: Increase effect size (keeping current sample size)\n")
cat(sprintf("  - Two-tailed t-test: Need difference of %.2f%% (current: %.2f%%)\n",
            pwr_effect_2t$d * pooled_sd, current_diff))
cat(sprintf("  - One-tailed t-test: Need difference of %.2f%% (current: %.2f%%)\n",
            pwr_effect_1t$d * pooled_sd, current_diff))
cat(sprintf("  - One-way ANOVA: Need difference of %.2f%% (current: %.2f%%)\n",
            pwr_effect_anova$f * 2 * pooled_sd, current_diff))
cat(sprintf("    (Cohen's f needed: %.4f, current: %.4f)\n",
            pwr_effect_anova$f, current_f))

cat("\nOPTION 3: Current situation\n")
cat(sprintf("  - Current power: %.1f%% (two-tailed t-test), %.1f%% (one-tailed t-test), %.1f%% (ANOVA)\n",
            pwr_current_2t$power * 100, pwr_current_1t$power * 100, pwr_current_anova$power * 100))
cat("  - This means there's a high probability of Type II error (false negative)\n")

cat("\nRECOMMENDATION:\n")
if (ceiling(pwr_result_1t$n) - n_current <= 10) {
  cat("  Consider recruiting ", ceiling(pwr_result_1t$n) - n_current, 
      " more participants per group to achieve adequate power.\n")
} else {
  cat("  Would need substantial increase in sample size (", 
      ceiling(pwr_result_1t$n) - n_current, " more per group).\n")
  cat("  Alternatively, consider if the intervention can be improved to increase effect size.\n")
}
