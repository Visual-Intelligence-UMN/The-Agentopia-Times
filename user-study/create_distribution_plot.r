# Create bar chart showing distribution of Pre, Post, and Improvement
# for Treatment and Control groups

library(ggplot2)
library(dplyr)
library(tidyr)

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

# Function to calculate mean and 95% CI
calc_stats <- function(data) {
  n <- length(data)
  mean_val <- mean(data)
  se <- sd(data) / sqrt(n)
  ci_lower <- mean_val - 1.96 * se
  ci_upper <- mean_val + 1.96 * se
  return(list(mean = mean_val, ci_lower = ci_lower, ci_upper = ci_upper, 
              sd = sd(data), n = n))
}

# Calculate statistics for each group
control_pre_stats <- calc_stats(control_pre)
control_post_stats <- calc_stats(control_post)
control_diff_stats <- calc_stats(control_diff)

treatment_pre_stats <- calc_stats(treatment_pre)
treatment_post_stats <- calc_stats(treatment_post)
treatment_diff_stats <- calc_stats(treatment_diff)

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
  ),
  SD = c(
    treatment_pre_stats$sd,
    treatment_post_stats$sd,
    treatment_diff_stats$sd,
    control_pre_stats$sd,
    control_post_stats$sd,
    control_diff_stats$sd
  ),
  N = c(
    treatment_pre_stats$n,
    treatment_post_stats$n,
    treatment_diff_stats$n,
    control_pre_stats$n,
    control_post_stats$n,
    control_diff_stats$n
  )
)

# Set factor levels for proper ordering
plot_data$Metric <- factor(plot_data$Metric, 
                           levels = c("Pre-study", "Post-study", "Improvement"))
plot_data$Group <- factor(plot_data$Group, levels = c("Treatment", "Control"))

# Create individual data points for jitter plot
individual_data <- data.frame(
  Group = c(rep("Treatment", length(treatment_pre) + length(treatment_post) + length(treatment_diff)),
            rep("Control", length(control_pre) + length(control_post) + length(control_diff))),
  Metric = c(rep("Pre-study", length(treatment_pre)),
             rep("Post-study", length(treatment_post)),
             rep("Improvement", length(treatment_diff)),
             rep("Pre-study", length(control_pre)),
             rep("Post-study", length(control_post)),
             rep("Improvement", length(control_diff))),
  Value = c(treatment_pre, treatment_post, treatment_diff,
            control_pre, control_post, control_diff)
)

individual_data$Metric <- factor(individual_data$Metric, 
                                 levels = c("Pre-study", "Post-study", "Improvement"))
individual_data$Group <- factor(individual_data$Group, levels = c("Treatment", "Control"))

# Create the plot with bars and individual points
p <- ggplot(plot_data, aes(x = Metric, y = Mean, fill = Group)) +
  geom_bar(stat = "identity", position = position_dodge(width = 0.8), 
           width = 0.7, alpha = 0.8) +
  geom_errorbar(aes(ymin = CI_Lower, ymax = CI_Upper), 
                position = position_dodge(width = 0.8), 
                width = 0.2, linewidth = 0.8) +
  geom_jitter(data = individual_data, 
              aes(x = Metric, y = Value, color = Group),
              position = position_jitterdodge(dodge.width = 0.8, jitter.width = 0.2),
              size = 1.5, alpha = 0.4, inherit.aes = FALSE) +
  scale_fill_manual(values = c("Treatment" = "#2E86AB", "Control" = "#A23B72"),
                    name = "Group") +
  scale_color_manual(values = c("Treatment" = "#2E86AB", "Control" = "#A23B72"),
                     guide = "none") +
  scale_y_continuous(limits = c(min(c(individual_data$Value, plot_data$CI_Lower), na.rm = TRUE) - 5,
                                max(c(individual_data$Value, plot_data$CI_Upper), na.rm = TRUE) + 10),
                     breaks = seq(-20, 120, 20),
                     labels = paste0(seq(-20, 120, 20), "%"),
                     name = "Score (%)") +
  labs(title = "Distribution of Pre-study, Post-study, and Improvement Scores",
       subtitle = "Mean ± 95% CI with individual data points",
       x = "",
       fill = "Group") +
  theme_minimal() +
  theme(
    plot.title = element_text(hjust = 0.5, size = 14, face = "bold"),
    plot.subtitle = element_text(hjust = 0.5, size = 11, color = "gray50"),
    axis.text.x = element_text(size = 11, angle = 0),
    axis.text.y = element_text(size = 10),
    axis.title.y = element_text(size = 11, margin = margin(r = 10)),
    legend.position = "right",
    legend.title = element_text(size = 11, face = "bold"),
    legend.text = element_text(size = 10),
    panel.grid.major.x = element_blank(),
    panel.grid.minor = element_blank(),
    panel.grid.major.y = element_line(color = "gray90", linetype = "dashed"),
    panel.background = element_rect(fill = "white", color = NA),
    plot.background = element_rect(fill = "white", color = NA)
  )

# Add mean value labels on bars
p <- p + geom_text(aes(label = sprintf("%.1f%%", Mean)),
                   position = position_dodge(width = 0.8),
                   vjust = -0.5, size = 3.5, fontface = "bold")

# Save the plot
ggsave("distribution_bar_chart.png", plot = p, width = 12, height = 7, dpi = 300)

cat("\nDistribution bar chart saved as 'distribution_bar_chart.png'\n")
cat("\nSummary Statistics:\n")
cat("\nTreatment Group:\n")
cat(sprintf("  Pre-study: %.2f%% ± %.2f%% (95%% CI: [%.2f%%, %.2f%%])\n",
            treatment_pre_stats$mean, treatment_pre_stats$sd,
            treatment_pre_stats$ci_lower, treatment_pre_stats$ci_upper))
cat(sprintf("  Post-study: %.2f%% ± %.2f%% (95%% CI: [%.2f%%, %.2f%%])\n",
            treatment_post_stats$mean, treatment_post_stats$sd,
            treatment_post_stats$ci_lower, treatment_post_stats$ci_upper))
cat(sprintf("  Improvement: %.2f%% ± %.2f%% (95%% CI: [%.2f%%, %.2f%%])\n",
            treatment_diff_stats$mean, treatment_diff_stats$sd,
            treatment_diff_stats$ci_lower, treatment_diff_stats$ci_upper))

cat("\nControl Group:\n")
cat(sprintf("  Pre-study: %.2f%% ± %.2f%% (95%% CI: [%.2f%%, %.2f%%])\n",
            control_pre_stats$mean, control_pre_stats$sd,
            control_pre_stats$ci_lower, control_pre_stats$ci_upper))
cat(sprintf("  Post-study: %.2f%% ± %.2f%% (95%% CI: [%.2f%%, %.2f%%])\n",
            control_post_stats$mean, control_post_stats$sd,
            control_post_stats$ci_lower, control_post_stats$ci_upper))
cat(sprintf("  Improvement: %.2f%% ± %.2f%% (95%% CI: [%.2f%%, %.2f%%])\n",
            control_diff_stats$mean, control_diff_stats$sd,
            control_diff_stats$ci_lower, control_diff_stats$ci_upper))
