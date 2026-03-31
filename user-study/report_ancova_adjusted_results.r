# 报告ANCOVA调整后的均值和置信区间
# Report ANCOVA Adjusted Means and Confidence Intervals

# 加载必要的库
library(dplyr)
library(car)

# 读取数据
control <- read.csv("control.csv", stringsAsFactors = FALSE)
treatment <- read.csv("treatment.csv", stringsAsFactors = FALSE)

# 清理数据
clean_percentage <- function(x) {
  as.numeric(gsub("%", "", x))
}

# 提取数据
control_pre <- clean_percentage(control$Correct.pre[1:(nrow(control)-1)])
control_post <- clean_percentage(control$Correct.post[1:(nrow(control)-1)])
treatment_pre <- clean_percentage(treatment$Correct.pre[1:nrow(treatment)])
treatment_post <- clean_percentage(treatment$Correct.post[1:nrow(treatment)])

# 准备ANCOVA数据
ancova_data <- data.frame(
  Group = factor(c(rep("Control", length(control_pre)), rep("Treatment", length(treatment_pre)))),
  Pre = c(control_pre, treatment_pre),
  Post = c(control_post, treatment_post)
)

# 拟合ANCOVA模型
ancova_model <- lm(Post ~ Pre + Group, data = ancova_data)
ancova_anova <- Anova(ancova_model, type = "II")

# 获取ANCOVA的p值
p_ancova <- ancova_anova["Group", "Pr(>F)"]

# 计算调整后的均值（在Pre的总体均值处）
grand_mean_pre <- mean(c(control_pre, treatment_pre))
ancova_coef <- coef(ancova_model)

# 调整后的Post均值
control_adj_post <- ancova_coef["(Intercept)"] + ancova_coef["Pre"] * grand_mean_pre
treatment_adj_post <- ancova_coef["(Intercept)"] + ancova_coef["GroupTreatment"] + 
                       ancova_coef["Pre"] * grand_mean_pre

# 计算调整后的置信区间
pred_control <- predict(ancova_model, 
                       newdata = data.frame(Group = "Control", Pre = grand_mean_pre),
                       se.fit = TRUE, interval = "confidence")
pred_treatment <- predict(ancova_model,
                         newdata = data.frame(Group = "Treatment", Pre = grand_mean_pre),
                         se.fit = TRUE, interval = "confidence")

control_post_ci_lower <- pred_control$fit[1, "lwr"]
control_post_ci_upper <- pred_control$fit[1, "upr"]
treatment_post_ci_lower <- pred_treatment$fit[1, "lwr"]
treatment_post_ci_upper <- pred_treatment$fit[1, "upr"]

# Pre的调整均值（在总体均值处，两组相同）
control_adj_pre <- grand_mean_pre
treatment_adj_pre <- grand_mean_pre

# Pre的置信区间（使用总体均值的标准误）
# 对于Pre，我们使用原始数据的均值和标准误
pre_se <- sd(c(control_pre, treatment_pre)) / sqrt(length(c(control_pre, treatment_pre)))
pre_ci_lower <- grand_mean_pre - qt(0.975, df = length(c(control_pre, treatment_pre)) - 1) * pre_se
pre_ci_upper <- grand_mean_pre + qt(0.975, df = length(c(control_pre, treatment_pre)) - 1) * pre_se

# 调整后的Improvement（Post - Pre）
control_adj_improvement <- control_adj_post - grand_mean_pre
treatment_adj_improvement <- treatment_adj_post - grand_mean_pre

# Improvement的置信区间
# 使用delta方法或直接计算：CI(Post) - Pre
control_improvement_ci_lower <- control_post_ci_lower - grand_mean_pre
control_improvement_ci_upper <- control_post_ci_upper - grand_mean_pre
treatment_improvement_ci_lower <- treatment_post_ci_lower - grand_mean_pre
treatment_improvement_ci_upper <- treatment_post_ci_upper - grand_mean_pre

cat("========================================\n")
cat("ANCOVA调整后的均值和置信区间报告\n")
cat("ANCOVA Adjusted Means and Confidence Intervals Report\n")
cat("========================================\n\n")

cat("ANCOVA模型: Post ~ Pre + Group\n")
cat(sprintf("Group效应: F(%d, %d) = %.4f, p = %.6f\n",
            ancova_anova["Group", "Df"],
            ancova_anova["Residuals", "Df"],
            ancova_anova["Group", "F"],
            p_ancova))

if (p_ancova < 0.001) {
  cat("  -> HIGHLY SIGNIFICANT (p < 0.001) ***\n")
} else if (p_ancova < 0.01) {
  cat("  -> VERY SIGNIFICANT (p < 0.01) **\n")
} else if (p_ancova < 0.05) {
  cat("  -> SIGNIFICANT (p < 0.05) *\n")
} else {
  cat("  -> NOT SIGNIFICANT (p >= 0.05)\n")
}

cat(sprintf("\n协变量Pre-score的总体均值: %.2f%%\n", grand_mean_pre))
cat("(调整后的均值在此值处计算)\n\n")

cat("========================================\n")
cat("1. PRE-STUDY SCORE (调整后)\n")
cat("========================================\n")
cat("Control组:\n")
cat(sprintf("  调整后均值: %.2f%%\n", control_adj_pre))
cat(sprintf("  95%% CI: [%.2f%%, %.2f%%]\n", pre_ci_lower, pre_ci_upper))
cat("\nTreatment组:\n")
cat(sprintf("  调整后均值: %.2f%%\n", treatment_adj_pre))
cat(sprintf("  95%% CI: [%.2f%%, %.2f%%]\n", pre_ci_lower, pre_ci_upper))
cat("\n(注: ANCOVA中Pre-score作为协变量，两组在总体均值处调整)\n\n")

cat("========================================\n")
cat("2. POST-STUDY SCORE (调整后)\n")
cat("========================================\n")
cat("Control组:\n")
cat(sprintf("  调整后均值: %.2f%%\n", control_adj_post))
cat(sprintf("  95%% CI: [%.2f%%, %.2f%%]\n", control_post_ci_lower, control_post_ci_upper))
cat("\nTreatment组:\n")
cat(sprintf("  调整后均值: %.2f%%\n", treatment_adj_post))
cat(sprintf("  95%% CI: [%.2f%%, %.2f%%]\n", treatment_post_ci_lower, treatment_post_ci_upper))
cat(sprintf("\n调整后均值差异: %.2f%%\n", treatment_adj_post - control_adj_post))
cat("\n")

cat("========================================\n")
cat("3. IMPROVEMENT (Post - Pre, 调整后)\n")
cat("========================================\n")
cat("Control组:\n")
cat(sprintf("  调整后均值: %.2f%%\n", control_adj_improvement))
cat(sprintf("  95%% CI: [%.2f%%, %.2f%%]\n", control_improvement_ci_lower, control_improvement_ci_upper))
cat("\nTreatment组:\n")
cat(sprintf("  调整后均值: %.2f%%\n", treatment_adj_improvement))
cat(sprintf("  95%% CI: [%.2f%%, %.2f%%]\n", treatment_improvement_ci_lower, treatment_improvement_ci_upper))
cat(sprintf("\n调整后均值差异: %.2f%%\n", treatment_adj_improvement - control_adj_improvement))
cat("\n")

cat("========================================\n")
cat("总结表格 (Summary Table)\n")
cat("========================================\n\n")

# 创建结果数据框
results_df <- data.frame(
  Group = c("Control", "Treatment"),
  Pre_Adj_Mean = c(control_adj_pre, treatment_adj_pre),
  Pre_CI_Lower = c(pre_ci_lower, pre_ci_lower),
  Pre_CI_Upper = c(pre_ci_upper, pre_ci_upper),
  Post_Adj_Mean = c(control_adj_post, treatment_adj_post),
  Post_CI_Lower = c(control_post_ci_lower, treatment_post_ci_lower),
  Post_CI_Upper = c(control_post_ci_upper, treatment_post_ci_upper),
  Improvement_Adj_Mean = c(control_adj_improvement, treatment_adj_improvement),
  Improvement_CI_Lower = c(control_improvement_ci_lower, treatment_improvement_ci_lower),
  Improvement_CI_Upper = c(control_improvement_ci_upper, treatment_improvement_ci_upper)
)

# 打印表格
cat("Pre-study Score (调整后):\n")
cat(sprintf("%-12s  Mean     95%% CI\n", "Group"))
cat("----------------------------------------\n")
cat(sprintf("%-12s  %.2f%%   [%.2f%%, %.2f%%]\n", 
            "Control", control_adj_pre, pre_ci_lower, pre_ci_upper))
cat(sprintf("%-12s  %.2f%%   [%.2f%%, %.2f%%]\n", 
            "Treatment", treatment_adj_pre, pre_ci_lower, pre_ci_upper))
cat("\n")

cat("Post-study Score (调整后):\n")
cat(sprintf("%-12s  Mean     95%% CI\n", "Group"))
cat("----------------------------------------\n")
cat(sprintf("%-12s  %.2f%%   [%.2f%%, %.2f%%]\n", 
            "Control", control_adj_post, control_post_ci_lower, control_post_ci_upper))
cat(sprintf("%-12s  %.2f%%   [%.2f%%, %.2f%%]\n", 
            "Treatment", treatment_adj_post, treatment_post_ci_lower, treatment_post_ci_upper))
cat("\n")

cat("Improvement (调整后):\n")
cat(sprintf("%-12s  Mean     95%% CI\n", "Group"))
cat("----------------------------------------\n")
cat(sprintf("%-12s  %.2f%%   [%.2f%%, %.2f%%]\n", 
            "Control", control_adj_improvement, control_improvement_ci_lower, control_improvement_ci_upper))
cat(sprintf("%-12s  %.2f%%   [%.2f%%, %.2f%%]\n", 
            "Treatment", treatment_adj_improvement, treatment_improvement_ci_lower, treatment_improvement_ci_upper))
cat("\n")

# 保存结果到CSV文件
write.csv(results_df, "ancova_adjusted_results.csv", row.names = FALSE)
cat("结果已保存到: ancova_adjusted_results.csv\n\n")

cat("分析完成！\n")
