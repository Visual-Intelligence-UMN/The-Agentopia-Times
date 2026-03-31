# 检查数据点数量
# Check number of data points

# 读取数据
control <- read.csv("control.csv", stringsAsFactors = FALSE)
treatment <- read.csv("treatment.csv", stringsAsFactors = FALSE)

# 清理数据
clean_percentage <- function(x) {
  as.numeric(gsub("%", "", x))
}

# 提取数据
cat("Control CSV文件:\n")
cat(sprintf("  总行数: %d\n", nrow(control)))
cat(sprintf("  列名: %s\n", paste(names(control), collapse = ", ")))
cat("\n")

cat("Treatment CSV文件:\n")
cat(sprintf("  总行数: %d\n", nrow(treatment)))
cat(sprintf("  列名: %s\n", paste(names(treatment), collapse = ", ")))
cat("\n")

# 检查最后一行
cat("Control最后一行:\n")
print(control[nrow(control), ])
cat("\n")

cat("Treatment最后一行:\n")
print(treatment[nrow(treatment), ])
cat("\n")

# 提取数据（按照可视化脚本的方式）
control_pre <- clean_percentage(control$Correct.pre[1:(nrow(control)-1)])
control_post <- clean_percentage(control$Correct.post[1:(nrow(control)-1)])
treatment_pre <- clean_percentage(treatment$Correct.pre[1:nrow(treatment)])
treatment_post <- clean_percentage(treatment$Correct.post[1:nrow(treatment)])

cat("提取的数据:\n")
cat(sprintf("  Control Pre: %d个值\n", length(control_pre)))
cat(sprintf("  Control Post: %d个值\n", length(control_post)))
cat(sprintf("  Treatment Pre: %d个值\n", length(treatment_pre)))
cat(sprintf("  Treatment Post: %d个值\n", length(treatment_post)))
cat("\n")

# 检查NA值
cat("检查NA值:\n")
cat(sprintf("  Control Pre NA数量: %d\n", sum(is.na(control_pre))))
cat(sprintf("  Control Post NA数量: %d\n", sum(is.na(control_post))))
cat(sprintf("  Treatment Pre NA数量: %d\n", sum(is.na(treatment_pre))))
cat(sprintf("  Treatment Post NA数量: %d\n", sum(is.na(treatment_post))))
cat("\n")

# 检查数据值
cat("数据值范围:\n")
cat(sprintf("  Control Pre: [%.2f, %.2f]\n", min(control_pre, na.rm = TRUE), max(control_pre, na.rm = TRUE)))
cat(sprintf("  Control Post: [%.2f, %.2f]\n", min(control_post, na.rm = TRUE), max(control_post, na.rm = TRUE)))
cat(sprintf("  Treatment Pre: [%.2f, %.2f]\n", min(treatment_pre, na.rm = TRUE), max(treatment_pre, na.rm = TRUE)))
cat(sprintf("  Treatment Post: [%.2f, %.2f]\n", min(treatment_post, na.rm = TRUE), max(treatment_post, na.rm = TRUE)))
cat("\n")

# 创建数据框
ancova_data <- data.frame(
  Group = factor(c(rep("Control", length(control_pre)), rep("Treatment", length(treatment_pre)))),
  Pre = c(control_pre, treatment_pre),
  Post = c(control_post, treatment_post)
)

cat("ANCOVA数据框:\n")
cat(sprintf("  总行数: %d\n", nrow(ancova_data)))
cat(sprintf("  Control组: %d行\n", sum(ancova_data$Group == "Control")))
cat(sprintf("  Treatment组: %d行\n", sum(ancova_data$Group == "Treatment")))
cat("\n")

# 检查是否有NA
cat("ANCOVA数据框中的NA:\n")
cat(sprintf("  Pre列NA数量: %d\n", sum(is.na(ancova_data$Pre))))
cat(sprintf("  Post列NA数量: %d\n", sum(is.na(ancova_data$Post))))
cat("\n")

# 打印所有数据点
cat("所有数据点:\n")
print(ancova_data)

cat("\n检查完成！\n")
