# 检查重叠的数据点
# Check for overlapping data points

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

# 创建数据框
ancova_data <- data.frame(
  Group = factor(c(rep("Control", length(control_pre)), rep("Treatment", length(treatment_pre)))),
  Pre = c(control_pre, treatment_pre),
  Post = c(control_post, treatment_post)
)

cat("========================================\n")
cat("检查重叠的数据点\n")
cat("========================================\n\n")

# 检查完全重叠的点（Pre和Post都相同）
cat("1. 完全重叠的点（Pre和Post都相同）:\n")
overlap_all <- duplicated(ancova_data[, c("Pre", "Post")]) | 
               duplicated(ancova_data[, c("Pre", "Post")], fromLast = TRUE)
overlap_data <- ancova_data[overlap_all, ]
if (nrow(overlap_data) > 0) {
  cat(sprintf("   找到 %d 个重叠的点:\n", nrow(overlap_data)))
  print(overlap_data)
  cat("\n")
} else {
  cat("   没有完全重叠的点\n\n")
}

# 检查Control组内的重叠
cat("2. Control组内的重叠点:\n")
control_data <- ancova_data[ancova_data$Group == "Control", ]
control_overlap <- duplicated(control_data[, c("Pre", "Post")]) | 
                   duplicated(control_data[, c("Pre", "Post")], fromLast = TRUE)
if (sum(control_overlap) > 0) {
  cat(sprintf("   找到 %d 个重叠的点:\n", sum(control_overlap)))
  print(control_data[control_overlap, ])
  cat("\n")
} else {
  cat("   没有重叠的点\n\n")
}

# 检查Treatment组内的重叠
cat("3. Treatment组内的重叠点:\n")
treatment_data <- ancova_data[ancova_data$Group == "Treatment", ]
treatment_overlap <- duplicated(treatment_data[, c("Pre", "Post")]) | 
                     duplicated(treatment_data[, c("Pre", "Post")], fromLast = TRUE)
if (sum(treatment_overlap) > 0) {
  cat(sprintf("   找到 %d 个重叠的点:\n", sum(treatment_overlap)))
  print(treatment_data[treatment_overlap, ])
  cat("\n")
} else {
  cat("   没有重叠的点\n\n")
}

# 统计每个唯一坐标的点数
cat("4. 每个唯一坐标的点数统计:\n")
unique_coords <- unique(ancova_data[, c("Pre", "Post")])
coord_counts <- table(paste(ancova_data$Pre, ancova_data$Post, sep = ","))
multi_points <- coord_counts[coord_counts > 1]
if (length(multi_points) > 0) {
  cat(sprintf("   有 %d 个坐标有多个点:\n", length(multi_points)))
  for (i in 1:length(multi_points)) {
    coord_str <- names(multi_points)[i]
    coords <- as.numeric(strsplit(coord_str, ",")[[1]])
    cat(sprintf("   (Pre=%.0f, Post=%.0f): %d个点\n", 
                coords[1], coords[2], multi_points[i]))
  }
  cat("\n")
} else {
  cat("   所有坐标都是唯一的\n\n")
}

# 统计总唯一坐标数
cat("5. 统计总结:\n")
cat(sprintf("   总数据点: %d\n", nrow(ancova_data)))
cat(sprintf("   唯一坐标数: %d\n", nrow(unique_coords)))
cat(sprintf("   重叠坐标数: %d\n", length(multi_points)))
cat(sprintf("   可视化中可见的唯一点: %d\n", nrow(unique_coords)))
cat(sprintf("   重叠的点（在可视化中会叠加显示）: %d\n", 
            nrow(ancova_data) - nrow(unique_coords)))
cat("\n")

cat("注意: 如果多个点有相同的坐标，它们在散点图中会重叠显示，\n")
cat("看起来像是一个点，但实际上有多个数据点。\n")
cat("可以使用jitter或不同的点形状来区分重叠的点。\n\n")

cat("检查完成！\n")
