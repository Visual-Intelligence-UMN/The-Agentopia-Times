# 检查Pre-study Score数据的正态性
# Normality Test for Pre-study Score Data

# 加载必要的库
library(ggplot2)
# 注意: 如果需要Anderson-Darling检验，需要安装nortest包: install.packages("nortest")
# 这里我们主要使用基础R包中的检验方法

# 读取数据
control <- read.csv("control.csv", stringsAsFactors = FALSE)
treatment <- read.csv("treatment.csv", stringsAsFactors = FALSE)

# 清理数据 - 移除百分号并转换为数值
clean_percentage <- function(x) {
  as.numeric(gsub("%", "", x))
}

# 提取pre-study分数
control_pre <- clean_percentage(control$Correct.pre[1:(nrow(control)-1)])
treatment_pre <- clean_percentage(treatment$Correct.pre[1:nrow(treatment)])

# 合并所有pre-study分数
all_pre <- c(control_pre, treatment_pre)

cat("========================================\n")
cat("PRE-STUDY SCORE 正态性检验\n")
cat("Normality Test for Pre-study Scores\n")
cat("========================================\n\n")

cat("数据摘要 (Data Summary):\n")
cat("------------------------\n")
cat(sprintf("Control组样本量: %d\n", length(control_pre)))
cat(sprintf("Treatment组样本量: %d\n", length(treatment_pre)))
cat(sprintf("总样本量: %d\n", length(all_pre)))
cat("\n")

cat("Control组Pre-study分数:\n")
cat(sprintf("  均值: %.2f%%\n", mean(control_pre)))
cat(sprintf("  中位数: %.2f%%\n", median(control_pre)))
cat(sprintf("  标准差: %.2f%%\n", sd(control_pre)))
cat(sprintf("  最小值: %.2f%%\n", min(control_pre)))
cat(sprintf("  最大值: %.2f%%\n", max(control_pre)))
cat(sprintf("  偏度: %.4f\n", (mean((control_pre - mean(control_pre))^3) / sd(control_pre)^3)))
cat(sprintf("  峰度: %.4f\n", (mean((control_pre - mean(control_pre))^4) / sd(control_pre)^4) - 3))
cat("\n")

cat("Treatment组Pre-study分数:\n")
cat(sprintf("  均值: %.2f%%\n", mean(treatment_pre)))
cat(sprintf("  中位数: %.2f%%\n", median(treatment_pre)))
cat(sprintf("  标准差: %.2f%%\n", sd(treatment_pre)))
cat(sprintf("  最小值: %.2f%%\n", min(treatment_pre)))
cat(sprintf("  最大值: %.2f%%\n", max(treatment_pre)))
cat(sprintf("  偏度: %.4f\n", (mean((treatment_pre - mean(treatment_pre))^3) / sd(treatment_pre)^3)))
cat(sprintf("  峰度: %.4f\n", (mean((treatment_pre - mean(treatment_pre))^4) / sd(treatment_pre)^4) - 3))
cat("\n")

cat("合并数据Pre-study分数:\n")
cat(sprintf("  均值: %.2f%%\n", mean(all_pre)))
cat(sprintf("  中位数: %.2f%%\n", median(all_pre)))
cat(sprintf("  标准差: %.2f%%\n", sd(all_pre)))
cat(sprintf("  最小值: %.2f%%\n", min(all_pre)))
cat(sprintf("  最大值: %.2f%%\n", max(all_pre)))
cat("\n")

# ============================================
# 正态性检验 - Control组
# ============================================
cat("\n========================================\n")
cat("CONTROL组正态性检验\n")
cat("========================================\n\n")

# Shapiro-Wilk检验
shapiro_control <- shapiro.test(control_pre)
cat("1. Shapiro-Wilk检验 (Shapiro-Wilk Test):\n")
cat(sprintf("   W = %.4f, p = %.6f\n", shapiro_control$statistic, shapiro_control$p.value))
if (shapiro_control$p.value < 0.05) {
  cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
} else {
  cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
}
cat("\n")

# Kolmogorov-Smirnov检验
ks_control <- ks.test(scale(control_pre), "pnorm")
cat("2. Kolmogorov-Smirnov检验 (Kolmogorov-Smirnov Test):\n")
cat(sprintf("   D = %.4f, p = %.6f\n", ks_control$statistic, ks_control$p.value))
if (ks_control$p.value < 0.05) {
  cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
} else {
  cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
}
cat("\n")

# Anderson-Darling检验 (需要nortest包)
# 如果已安装nortest包，可以取消下面的注释
# ad_control <- ad.test(control_pre)
# cat("3. Anderson-Darling检验 (Anderson-Darling Test):\n")
# cat(sprintf("   A = %.4f, p = %.6f\n", ad_control$statistic, ad_control$p.value))
# if (ad_control$p.value < 0.05) {
#   cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
# } else {
#   cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
# }
cat("\n")

# ============================================
# 正态性检验 - Treatment组
# ============================================
cat("\n========================================\n")
cat("TREATMENT组正态性检验\n")
cat("========================================\n\n")

# Shapiro-Wilk检验
shapiro_treatment <- shapiro.test(treatment_pre)
cat("1. Shapiro-Wilk检验 (Shapiro-Wilk Test):\n")
cat(sprintf("   W = %.4f, p = %.6f\n", shapiro_treatment$statistic, shapiro_treatment$p.value))
if (shapiro_treatment$p.value < 0.05) {
  cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
} else {
  cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
}
cat("\n")

# Kolmogorov-Smirnov检验
ks_treatment <- ks.test(scale(treatment_pre), "pnorm")
cat("2. Kolmogorov-Smirnov检验 (Kolmogorov-Smirnov Test):\n")
cat(sprintf("   D = %.4f, p = %.6f\n", ks_treatment$statistic, ks_treatment$p.value))
if (ks_treatment$p.value < 0.05) {
  cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
} else {
  cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
}
cat("\n")

# Anderson-Darling检验 (需要nortest包)
# 如果已安装nortest包，可以取消下面的注释
# ad_treatment <- ad.test(treatment_pre)
# cat("3. Anderson-Darling检验 (Anderson-Darling Test):\n")
# cat(sprintf("   A = %.4f, p = %.6f\n", ad_treatment$statistic, ad_treatment$p.value))
# if (ad_treatment$p.value < 0.05) {
#   cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
# } else {
#   cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
# }
cat("\n")

# ============================================
# 正态性检验 - 合并数据
# ============================================
cat("\n========================================\n")
cat("合并数据正态性检验 (Combined Data)\n")
cat("========================================\n\n")

# Shapiro-Wilk检验
shapiro_all <- shapiro.test(all_pre)
cat("1. Shapiro-Wilk检验 (Shapiro-Wilk Test):\n")
cat(sprintf("   W = %.4f, p = %.6f\n", shapiro_all$statistic, shapiro_all$p.value))
if (shapiro_all$p.value < 0.05) {
  cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
} else {
  cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
}
cat("\n")

# Kolmogorov-Smirnov检验
ks_all <- ks.test(scale(all_pre), "pnorm")
cat("2. Kolmogorov-Smirnov检验 (Kolmogorov-Smirnov Test):\n")
cat(sprintf("   D = %.4f, p = %.6f\n", ks_all$statistic, ks_all$p.value))
if (ks_all$p.value < 0.05) {
  cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
} else {
  cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
}
cat("\n")

# Anderson-Darling检验 (需要nortest包)
# 如果已安装nortest包，可以取消下面的注释
# ad_all <- ad.test(all_pre)
# cat("3. Anderson-Darling检验 (Anderson-Darling Test):\n")
# cat(sprintf("   A = %.4f, p = %.6f\n", ad_all$statistic, ad_all$p.value))
# if (ad_all$p.value < 0.05) {
#   cat("   结论: 数据不符合正态分布 (p < 0.05) ✗\n")
# } else {
#   cat("   结论: 数据符合正态分布 (p >= 0.05) ✓\n")
# }
cat("\n")

# ============================================
# 总结
# ============================================
cat("\n========================================\n")
cat("总结 (Summary)\n")
cat("========================================\n\n")

cat("Control组:\n")
control_normal <- (shapiro_control$p.value >= 0.05 && 
                   ks_control$p.value >= 0.05)
if (control_normal) {
  cat("  ✓ 数据符合正态分布\n")
} else {
  cat("  ✗ 数据不符合正态分布\n")
  cat("    建议: 考虑使用非参数检验 (Wilcoxon检验等)\n")
}
cat("\n")

cat("Treatment组:\n")
treatment_normal <- (shapiro_treatment$p.value >= 0.05 && 
                     ks_treatment$p.value >= 0.05)
if (treatment_normal) {
  cat("  ✓ 数据符合正态分布\n")
} else {
  cat("  ✗ 数据不符合正态分布\n")
  cat("    建议: 考虑使用非参数检验 (Wilcoxon检验等)\n")
}
cat("\n")

cat("合并数据:\n")
all_normal <- (shapiro_all$p.value >= 0.05 && 
               ks_all$p.value >= 0.05)
if (all_normal) {
  cat("  ✓ 数据符合正态分布\n")
} else {
  cat("  ✗ 数据不符合正态分布\n")
}
cat("\n")

# ============================================
# 创建可视化图表
# ============================================
cat("正在生成可视化图表...\n")

# 准备数据框用于绘图
plot_data <- data.frame(
  Group = factor(c(rep("Control", length(control_pre)), 
                  rep("Treatment", length(treatment_pre)))),
  PreScore = c(control_pre, treatment_pre)
)

# 1. 直方图 + 密度曲线
png("pre_study_normality_histogram.png", width = 1200, height = 800, res = 150)
par(mfrow = c(2, 2))

# Control组直方图
hist(control_pre, breaks = 10, main = "Control组 Pre-study分数分布", 
     xlab = "Pre-study分数 (%)", ylab = "频数", col = "lightblue", 
     border = "black", freq = FALSE)
curve(dnorm(x, mean = mean(control_pre), sd = sd(control_pre)), 
      add = TRUE, col = "red", lwd = 2)
legend("topright", legend = c("观测数据", "理论正态分布"), 
       fill = c("lightblue", "red"), cex = 0.8)

# Treatment组直方图
hist(treatment_pre, breaks = 10, main = "Treatment组 Pre-study分数分布", 
     xlab = "Pre-study分数 (%)", ylab = "频数", col = "lightgreen", 
     border = "black", freq = FALSE)
curve(dnorm(x, mean = mean(treatment_pre), sd = sd(treatment_pre)), 
      add = TRUE, col = "red", lwd = 2)
legend("topright", legend = c("观测数据", "理论正态分布"), 
       fill = c("lightgreen", "red"), cex = 0.8)

# 合并数据直方图
hist(all_pre, breaks = 15, main = "合并数据 Pre-study分数分布", 
     xlab = "Pre-study分数 (%)", ylab = "频数", col = "lightyellow", 
     border = "black", freq = FALSE)
curve(dnorm(x, mean = mean(all_pre), sd = sd(all_pre)), 
      add = TRUE, col = "red", lwd = 2)
legend("topright", legend = c("观测数据", "理论正态分布"), 
       fill = c("lightyellow", "red"), cex = 0.8)

# 箱线图比较
boxplot(control_pre, treatment_pre, 
        names = c("Control", "Treatment"),
        main = "Pre-study分数箱线图比较",
        ylab = "Pre-study分数 (%)",
        col = c("lightblue", "lightgreen"))
dev.off()

# 2. Q-Q图
png("pre_study_normality_qqplot.png", width = 1200, height = 800, res = 150)
par(mfrow = c(2, 2))

# Control组Q-Q图
qqnorm(control_pre, main = "Control组 Q-Q图", pch = 19, col = "blue")
qqline(control_pre, col = "red", lwd = 2)

# Treatment组Q-Q图
qqnorm(treatment_pre, main = "Treatment组 Q-Q图", pch = 19, col = "green")
qqline(treatment_pre, col = "red", lwd = 2)

# 合并数据Q-Q图
qqnorm(all_pre, main = "合并数据 Q-Q图", pch = 19, col = "orange")
qqline(all_pre, col = "red", lwd = 2)

# 密度图比较
plot(density(control_pre), main = "密度图比较", 
     xlab = "Pre-study分数 (%)", ylab = "密度", 
     col = "blue", lwd = 2, xlim = c(0, 100), ylim = c(0, 0.05))
lines(density(treatment_pre), col = "green", lwd = 2)
curve(dnorm(x, mean = mean(control_pre), sd = sd(control_pre)), 
      add = TRUE, col = "red", lty = 2, lwd = 2)
curve(dnorm(x, mean = mean(treatment_pre), sd = sd(treatment_pre)), 
      add = TRUE, col = "red", lty = 2, lwd = 2)
legend("topright", legend = c("Control", "Treatment", "理论正态分布"), 
       col = c("blue", "green", "red"), lty = c(1, 1, 2), lwd = 2, cex = 0.8)
dev.off()

cat("可视化图表已保存:\n")
cat("  - pre_study_normality_histogram.png (直方图)\n")
cat("  - pre_study_normality_qqplot.png (Q-Q图)\n")
cat("\n")

cat("分析完成！\n")
