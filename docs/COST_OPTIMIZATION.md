# Cost Optimization Summary

> **Optimization Date:** October 27, 2025  
> **Objective:** Reduce AWS costs for 1-2 concurrent users while maintaining full functionality

## 💰 Cost Savings

### Before vs After

| Resource | Before | After | Monthly Savings |
|----------|--------|-------|-----------------|
| **EC2 Instance** | m7i.large | t3.medium | $32 |
| **Container Memory** | 2GB/session | 1.5GB/session | Efficiency gain |
| **Session TTL** | 45 min | 45 min | No change |
| **NAT Gateway** | 1 gateway | 1 gateway | No change |

### Total Impact
- **Monthly Savings:** $32 (26% reduction)
- **Annual Savings:** $384
- **New Monthly Cost:** ~$93 (down from ~$125)

## 🎯 Changes Made

### 1. EC2 Instance Downgrade
**Change:** m7i.large → t3.medium

**Rationale:**
- m7i.large: 2 vCPU, 8GB RAM ($62/month)
- t3.medium: 2 vCPU, 4GB RAM ($30/month)
- For 1-2 concurrent sessions, 4GB RAM is sufficient
- t3 burstable CPU credits perfect for sporadic workload

**Implementation:**
```bash
# Updated Launch Template
Instance Type: t3.medium
CPU: 2 vCPU
Memory: 4GB RAM
Architecture: x86_64
```

### 2. Container Memory Optimization
**Change:** 2GB → 1.5GB per session container

**Rationale:**
- Sessions use ~1GB RAM on average
- 1.5GB provides comfortable headroom
- Allows 2 concurrent sessions on t3.medium (4GB total)

**Implementation:**
```bash
RUNNER_MEMORY=1536m
RUNNER_NANO_CPUS=1000000000 (1 CPU)
```

### 3. Session TTL (No Change)
**Decision:** Kept at 45 minutes

**Rationale:**
- Originally planned to reduce to 30 minutes
- After testing, 45 minutes provides better UX
- Minimal cost impact for low user count
- Code prepared for future 30-min change if needed

## 📊 Capacity Analysis

### Current Capacity
- **EC2:** t3.medium (2 vCPU, 4GB RAM)
- **Max Sessions:** 2 concurrent (comfortably)
- **Per Session:** 1.5GB RAM, 1 vCPU
- **Headroom:** ~1GB RAM reserved for system/overhead

### Usage Scenarios

#### Light Usage (1 user)
- RAM Used: ~1.5GB
- CPU Used: ~50%
- Status: ✅ Excellent performance

#### Normal Usage (2 users)
- RAM Used: ~3GB
- CPU Used: ~100%  
- Status: ✅ Comfortable

#### Peak Usage (>2 users)
- RAM: Would approach 4GB limit
- CPU: t3 burst credits available
- Status: ⚠️ Not recommended for extended periods

## 🏗️ Architecture Decisions

### Why Not Fargate for Everything?
- **Cost:** Fargate more expensive for always-on workloads
- **Flexibility:** EC2 allows custom instance optimization
- **Control:** Direct control over runner environment

### Why t3 vs t3a?
- **t3:** Intel, better single-thread performance
- **t3a:** AMD, 10% cheaper but slightly lower perf
- **Decision:** t3 for consistency with existing setup

### Why Not Spot Instances?
- **Reliability:** Spot can be interrupted
- **User Experience:** Sessions would be killed
- **Cost:** Savings minimal for single instance

## 📈 Scaling Considerations

### If User Count Increases

#### 3-5 Users
- **Option 1:** t3.large (2 vCPU, 8GB) - $60/month
- **Option 2:** Add second t3.medium with ASG
- **Recommendation:** t3.large (simpler)

#### 5-10 Users
- **Recommended:** t3.xlarge (4 vCPU, 16GB) - $120/month
- **Alternative:** Auto Scaling Group with 2-3 t3.medium
- **Trade-off:** Cost vs complexity

#### 10+ Users
- **Recommended:** Full Auto Scaling Group
- **Instance:** t3.large or t3.xlarge
- **Min/Max:** 1-3 instances based on demand
- **Note:** Requires ASG policy tuning

## 🔄 Rollback Plan

If performance issues arise:

### Quick Rollback (Emergency)
```bash
# Update Launch Template to m7i.large
# Update ASG with new template
# Terminate current t3.medium instance
# Wait for m7i.large to launch
```

### Cost Impact
- Returns to $125/month
- Restores 8GB RAM capacity

## ✅ Validation & Monitoring

### Performance Metrics to Watch
- **EC2 CPU Utilization:** Should stay < 80% average
- **EC2 Memory Utilization:** Should stay < 75%
- **Session Container OOM:** Should be 0
- **User Experience:** No timeouts or slowness

### Current Status (Oct 27, 2025)
- ✅ All services running smoothly
- ✅ Authentication working
- ✅ Sessions launching successfully
- ✅ No performance degradation observed

## 🎓 Lessons Learned

1. **Test Before Optimizing**
   - Analyzed actual usage patterns first
   - Made data-driven decisions

2. **Document Everything**
   - Preserved all changes in git
   - Created rollback procedures

3. **Incremental Changes**
   - Changed one thing at a time
   - Validated each change

4. **User Experience First**
   - Kept 45-min session TTL for UX
   - Didn't sacrifice reliability for cost

## 🔮 Future Optimization Opportunities

### Potential Savings
1. **Reserved Instances:** 30-40% savings if committing 1-3 years
2. **Savings Plans:** More flexible than RI, similar savings
3. **Spot for Dev/Test:** Use spot instances for non-production

### Not Recommended (Trade-offs Not Worth It)
- ❌ Reduce to t3.small - Too little RAM
- ❌ Remove NAT Gateway - Breaks outbound connectivity
- ❌ Use public subnets - Security risk
- ❌ Session timeout < 30 min - Poor UX

## 📝 Notes

- Infrastructure designed for 1-2 concurrent users
- Can scale to 3-5 with minimal changes
- All optimizations maintain full functionality
- No features removed or degraded
- Cost reduction achieved through right-sizing only
