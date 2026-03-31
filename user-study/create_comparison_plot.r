# Create comparison plot similar to the reference image
# Horizontal bar charts showing Pre-study, Post-study, and Improvement
# Using ANCOVA-adjusted means and CI

library(ggplot2)
library(dplyr)
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

# Perform ANCOVA to get adjusted means
ancova_data <- data.frame(
  Group = factor(c(rep("Control", length(control_pre)), rep("Treatment", length(treatment_pre)))),
  Pre = c(control_pre, treatment_pre),
  Post = c(control_post, treatment_post)
)

ancova_model <- lm(Post ~ Pre + Group, data = ancova_data)
grand_mean_pre <- mean(c(control_pre, treatment_pre))

# Get adjusted means and CI
pred_control <- predict(ancova_model, 
                       newdata = data.frame(Group = "Control", Pre = grand_mean_pre),
                       se.fit = TRUE, interval = "confidence")
pred_treatment <- predict(ancova_model,
                         newdata = data.frame(Group = "Treatment", Pre = grand_mean_pre),
                         se.fit = TRUE, interval = "confidence")

# Function to calculate mean and 95% CI for pre-study (use actual observed values)
calc_pre_stats <- function(data) {
  n <- length(data)
  mean_val <- mean(data)
  se <- sd(data) / sqrt(n)
  ci_lower <- mean_val - 1.96 * se
  ci_upper <- mean_val + 1.96 * se
  return(list(mean = mean_val, ci_lower = ci_lower, ci_upper = ci_upper))
}

# Pre-study statistics (use actual observed values, not adjusted)
control_pre_stats <- calc_pre_stats(control_pre)
treatment_pre_stats <- calc_pre_stats(treatment_pre)

# ANCOVA-adjusted statistics for post-study and improvement
control_post_mean <- as.numeric(pred_control$fit[1])
control_post_stats <- list(mean = control_post_mean, 
                           ci_lower = pred_control$fit[1, "lwr"], 
                           ci_upper = pred_control$fit[1, "upr"])

# For improvement, use adjusted post minus actual pre mean (not grand mean)
control_improvement <- control_post_mean - control_pre_stats$mean
# CI for improvement: use adjusted post CI minus actual pre mean
control_improvement_ci_lower <- pred_control$fit[1, "lwr"] - control_pre_stats$mean
control_improvement_ci_upper <- pred_control$fit[1, "upr"] - control_pre_stats$mean
control_diff_stats <- list(mean = control_improvement,
                          ci_lower = control_improvement_ci_lower,
                          ci_upper = control_improvement_ci_upper)

treatment_post_mean <- as.numeric(pred_treatment$fit[1])
treatment_post_stats <- list(mean = treatment_post_mean,
                            ci_lower = pred_treatment$fit[1, "lwr"],
                            ci_upper = pred_treatment$fit[1, "upr"])

# For improvement, use adjusted post minus actual pre mean
treatment_improvement <- treatment_post_mean - treatment_pre_stats$mean
treatment_improvement_ci_lower <- pred_treatment$fit[1, "lwr"] - treatment_pre_stats$mean
treatment_improvement_ci_upper <- pred_treatment$fit[1, "upr"] - treatment_pre_stats$mean
treatment_diff_stats <- list(mean = treatment_improvement,
                            ci_lower = treatment_improvement_ci_lower,
                            ci_upper = treatment_improvement_ci_upper)

# Paired t-test for pre-post comparison within each group
control_prepost_test <- t.test(control_post, control_pre, paired = TRUE)
treatment_prepost_test <- t.test(treatment_post, treatment_pre, paired = TRUE)

# ANCOVA for improvement comparison between groups
ancova_anova <- Anova(ancova_model, type = "II")
p_ancova <- ancova_anova["Group", "Pr(>F)"]

# Create data frame for plotting
plot_data <- data.frame(
  Group = rep(c("Treatment", "Control"), each = 3),
  Metric = rep(c("Pre-study", "Post-study", "Improvement"), 2),
  Mean = c(
    treatment_pre_stats$mean,
    treatment_post_stats$mean,
    treatment_diff_stats$mean,
    control_pre_stats$mean,
    control_post_stats$mean,
    control_diff_stats$mean
  ),
  CI_Lower = c(
    treatment_pre_stats$ci_lower,
    treatment_post_stats$ci_lower,
    treatment_diff_stats$ci_lower,
    control_pre_stats$ci_lower,
    control_post_stats$ci_lower,
    control_diff_stats$ci_lower
  ),
  CI_Upper = c(
    treatment_pre_stats$ci_upper,
    treatment_post_stats$ci_upper,
    treatment_diff_stats$ci_upper,
    control_pre_stats$ci_upper,
    control_post_stats$ci_upper,
    control_diff_stats$ci_upper
  )
)

# Set factor levels for proper ordering
plot_data$Metric <- factor(plot_data$Metric, 
                           levels = c("Pre-study", "Post-study", "Improvement"))
plot_data$Group <- factor(plot_data$Group, levels = c("Treatment", "Control"))

# Create p-value annotations
p_control_prepost <- control_prepost_test$p.value
p_treatment_prepost <- treatment_prepost_test$p.value
p_improvement_diff <- p_ancova  # Use ANCOVA p-value

# Format p-values (for console output only, not displayed on plot)
format_pvalue <- function(p) {
  if (p < 0.001) {
    return(sprintf("p = %.3e", p))
  } else if (p < 0.01) {
    return(sprintf("p = %.4f", p))
  } else {
    return(sprintf("p = %.4f", p))
  }
}

# Calculate max x limit for consistent scaling
max_x <- max(plot_data$CI_Upper) + 25

# Create the plot
p <- ggplot(plot_data, aes(x = Mean, y = Metric, fill = Group)) +
  geom_bar(stat = "identity", width = 0.6, alpha = 0.85, color = "black", linewidth = 0.5) +
  geom_errorbar(aes(xmin = CI_Lower, xmax = CI_Upper), 
                width = 0.2, orientation = "y") +
  facet_wrap(~Group, ncol = 1, scales = "free_y") +
  scale_fill_manual(values = c("Treatment" = "#2E86AB", "Control" = "#A23B72")) +
  scale_x_continuous(limits = c(0, max_x), 
                     breaks = seq(0, 100, 20),
                     labels = paste0(seq(0, 100, 20), "%"),
                     expand = expansion(mult = c(0, 0.1)),
                     name = "Mean ± 95% CI (measure in accuracy rate)") +
  scale_y_discrete(limits = rev(levels(plot_data$Metric))) +
  labs(title = "",
       y = "") +
  theme_minimal() +
  theme(
    plot.title = element_text(hjust = 0.5, size = 14, face = "bold"),
    axis.text.y = element_text(size = 11, color = "black"),
    axis.text.x = element_text(size = 10),
    axis.title.x = element_text(size = 11, margin = margin(t = 10)),
    strip.text = element_text(size = 12, face = "bold", margin = margin(b = 10)),
    legend.position = "none",
    panel.grid.major.y = element_blank(),
    panel.grid.minor = element_blank(),
    panel.grid.major.x = element_line(color = "gray90", linetype = "solid", linewidth = 0.8),
    panel.background = element_rect(fill = "white", color = NA),
    strip.background = element_rect(fill = "white", color = NA),
    plot.margin = margin(20, 40, 20, 20)
  )

# Save the plot
ggsave("comparison_plot.png", plot = p, width = 10, height = 6, dpi = 300)

cat("\nPlot saved as 'comparison_plot.png'\n")
cat("\nP-values:\n")
cat(sprintf("  Treatment pre-post: %s\n", format_pvalue(p_treatment_prepost)))
cat(sprintf("  Control pre-post: %s\n", format_pvalue(p_control_prepost)))
cat(sprintf("  Improvement difference: %s\n", format_pvalue(p_improvement_diff)))
