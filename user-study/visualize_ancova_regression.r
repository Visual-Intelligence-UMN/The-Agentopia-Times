# ANCOVA回归模型可视化
# Visualize ANCOVA as Regression Model

# 加载必要的库
library(ggplot2)
library(car)
library(dplyr)

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
ancova_summary <- summary(ancova_model)
ancova_anova <- Anova(ancova_model, type = "II")

# 获取模型系数
coefs <- coef(ancova_model)
intercept_control <- coefs["(Intercept)"]
slope <- coefs["Pre"]
intercept_treatment <- intercept_control + coefs["GroupTreatment"]

# 获取ANCOVA的p值
p_ancova <- ancova_anova["Group", "Pr(>F)"]

# 计算调整后的均值（在Pre的总体均值处）
grand_mean_pre <- mean(c(control_pre, treatment_pre))

# 调整后的Post均值
control_adj_post <- intercept_control + slope * grand_mean_pre
treatment_adj_post <- intercept_treatment + slope * grand_mean_pre

# 计算调整后的置信区间
pred_control <- predict(ancova_model, 
                       newdata = data.frame(Group = "Control", Pre = grand_mean_pre),
                       se.fit = TRUE, interval = "confidence")
pred_treatment <- predict(ancova_model,
                         newdata = data.frame(Group = "Treatment", Pre = grand_mean_pre),
                         se.fit = TRUE, interval = "confidence")

# 创建预测数据用于绘制回归线和置信区间
# 使用Pre的实际范围，但扩展到合理范围
pre_min <- max(0, min(ancova_data$Pre) - 5)
pre_max <- min(100, max(ancova_data$Pre) + 5)
pre_range <- seq(pre_min, pre_max, length.out = 100)

# Control组的预测
pred_control_range <- predict(ancova_model,
                             newdata = data.frame(Group = "Control", Pre = pre_range),
                             se.fit = TRUE, interval = "confidence")
pred_control_df <- data.frame(
  Pre = pre_range,
  Post = pred_control_range$fit[, "fit"],
  Post_lwr = pmax(0, pmin(100, pred_control_range$fit[, "lwr"])),  # 限制在0-100范围内
  Post_upr = pmax(0, pmin(100, pred_control_range$fit[, "upr"])),  # 限制在0-100范围内
  Group = "Control"
)

# Treatment组的预测
pred_treatment_range <- predict(ancova_model,
                               newdata = data.frame(Group = "Treatment", Pre = pre_range),
                               se.fit = TRUE, interval = "confidence")
pred_treatment_df <- data.frame(
  Pre = pre_range,
  Post = pred_treatment_range$fit[, "fit"],
  Post_lwr = pmax(0, pmin(100, pred_treatment_range$fit[, "lwr"])),  # 限制在0-100范围内
  Post_upr = pmax(0, pmin(100, pred_treatment_range$fit[, "upr"])),  # 限制在0-100范围内
  Group = "Treatment"
)

# 合并预测数据
pred_all_df <- rbind(pred_control_df, pred_treatment_df)

# 创建调整后的均值点数据
adj_means_df <- data.frame(
  Group = c("Control", "Treatment"),
  Pre = c(grand_mean_pre, grand_mean_pre),
  Post = c(control_adj_post, treatment_adj_post),
  Post_lwr = c(pred_control$fit[1, "lwr"], pred_treatment$fit[1, "lwr"]),
  Post_upr = c(pred_control$fit[1, "upr"], pred_treatment$fit[1, "upr"])
)

# 计算每个坐标的重叠数量（用于验证输出）
ancova_data$coord_key <- paste(ancova_data$Pre, ancova_data$Post, sep = ",")
coord_counts <- table(ancova_data$coord_key)
ancova_data$overlap_count <- as.numeric(coord_counts[ancova_data$coord_key])

# 创建图形
p1 <- ggplot(ancova_data, aes(x = Pre, y = Post, color = Group, fill = Group)) +
  # 参考线: (0,0) 到 (90,90)，表示 Pre=Post（无提升）
  annotate("segment", x = 0, y = 0, xend = 90, yend = 90,
           color = "gray40", linewidth = 0.9, linetype = "dashed") +
  # 置信区间带
  geom_ribbon(data = pred_all_df, aes(x = Pre, ymin = Post_lwr, ymax = Post_upr),
              alpha = 0.2, linetype = 0) +
  # 回归线
  geom_line(data = pred_all_df, aes(x = Pre, y = Post, color = Group),
            linewidth = 1.2, linetype = "solid") +
  # 原始数据点（添加轻微抖动以显示重叠的点，黑色边框）
  geom_point(size = 4, alpha = 0.7, shape = 21, color = "white", stroke = 0.5,
             position = position_jitter(width = 0.8, height = 0.8, seed = 123)) +
  # 调整后的均值点（在总体均值处）
  geom_point(data = adj_means_df, aes(x = Pre, y = Post),
             size = 6, shape = 21, fill = "white", color = "black", stroke = 2) +
  # 调整后均值的置信区间（垂直线）
  geom_errorbar(data = adj_means_df, aes(x = Pre, ymin = Post_lwr, ymax = Post_upr),
                width = 2, linewidth = 1, color = "black") +
  # 总体均值处的垂直线
  geom_vline(xintercept = grand_mean_pre, linetype = "dashed", 
             color = "gray50", linewidth = 0.8, alpha = 0.7) +
  # 标签和主题
  labs(
    title = "ANCOVA回归模型可视化\nPost-score ~ Pre-score + Group",
    subtitle = sprintf("Group效应: F(%d, %d) = %.2f, p = %.4f %s",
                      ancova_anova["Group", "Df"],
                      ancova_anova["Residuals", "Df"],
                      ancova_anova["Group", "F"],
                      p_ancova,
                      ifelse(p_ancova < 0.001, "***",
                             ifelse(p_ancova < 0.01, "**",
                                    ifelse(p_ancova < 0.05, "*", "")))),
    x = "Pre-study Score (%)",
    y = "Post-study Score (%)",
    color = "Group",
    fill = "Group",
    caption = sprintf("实线: 回归线 | 阴影区域: 95%%置信区间 | 白色圆点: 调整后均值(在Pre总体均值处)\n虚线: Pre=Post (无提升参考线) | 共%d个数据点", nrow(ancova_data))
  ) +
  scale_color_manual(values = c("Control" = "#A7AFB6", "Treatment" = "#003F5C")) +
  scale_fill_manual(values = c("Control" = "#A7AFB6", "Treatment" = "#003F5C")) +
  theme_minimal(base_size = 12) +
  theme(
    plot.title = element_text(size = 14, face = "bold", hjust = 0.5),
    plot.subtitle = element_text(size = 11, hjust = 0.5, margin = margin(b = 15)),
    plot.caption = element_text(size = 9, color = "gray50", hjust = 0),
    legend.position = "bottom",
    panel.grid.minor = element_blank(),
    axis.text = element_text(size = 10),
    axis.title = element_text(size = 11, face = "bold")
  ) +
  # 使用coord_cartesian只改变显示范围，不过滤数据点
  coord_cartesian(xlim = c(0, max(ancova_data$Pre, ancova_data$Post) * 1.1),
                  ylim = c(0, max(ancova_data$Post) * 1.1))

# 保存图形
ggsave("ancova_regression_plot.png", plot = p1, width = 10, height = 8, dpi = 300)

cat("ANCOVA回归模型可视化已保存: ancova_regression_plot.png\n\n")

# 验证数据点数量
cat("========================================\n")
cat("数据点验证\n")
cat("========================================\n")
cat(sprintf("ANCOVA数据框总行数: %d\n", nrow(ancova_data)))
cat(sprintf("Control组数据点: %d\n", sum(ancova_data$Group == "Control")))
cat(sprintf("Treatment组数据点: %d\n", sum(ancova_data$Group == "Treatment")))
unique_coords <- unique(ancova_data[, c("Pre", "Post")])
overlap_coords <- unique_coords[coord_counts[paste(unique_coords$Pre, unique_coords$Post, sep = ",")] > 1, ]
cat(sprintf("唯一坐标数: %d\n", nrow(unique_coords)))
cat(sprintf("有重叠的坐标数: %d\n", nrow(overlap_coords)))
cat(sprintf("重叠的点数: %d\n", sum(ancova_data$overlap_count > 1)))
cat(sprintf("所有数据点应在可视化中显示\n\n"))

# 打印模型信息
cat("========================================\n")
cat("ANCOVA回归模型信息\n")
cat("========================================\n\n")
cat("模型: Post ~ Pre + Group\n\n")
cat("回归系数:\n")
cat(sprintf("  Control组截距: %.4f\n", intercept_control))
cat(sprintf("  Treatment组截距: %.4f\n", intercept_treatment))
cat(sprintf("  Pre-score斜率: %.4f\n", slope))
cat(sprintf("  截距差异: %.4f\n", coefs["GroupTreatment"]))
cat("\n")

cat("回归方程:\n")
cat(sprintf("  Control组: Post = %.2f + %.2f × Pre\n", intercept_control, slope))
cat(sprintf("  Treatment组: Post = %.2f + %.2f × Pre\n", intercept_treatment, slope))
cat("\n")

cat(sprintf("在Pre总体均值 (%.2f%%) 处的调整后均值:\n", grand_mean_pre))
cat(sprintf("  Control组: %.2f%%\n", control_adj_post))
cat(sprintf("  Treatment组: %.2f%%\n", treatment_adj_post))
cat(sprintf("  差异: %.2f%%\n", treatment_adj_post - control_adj_post))
cat("\n")

cat("模型统计:\n")
cat(sprintf("  R² = %.4f\n", ancova_summary$r.squared))
cat(sprintf("  调整R² = %.4f\n", ancova_summary$adj.r.squared))
cat(sprintf("  F统计量 = %.4f, p = %.6f\n", 
            ancova_anova["Group", "F"], p_ancova))
cat("\n")

cat("可视化完成！\n")
