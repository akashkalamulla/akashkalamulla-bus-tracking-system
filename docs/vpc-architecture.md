# VPC Architecture Design - Bus Tracking System

This document outlines the Virtual Private Cloud (VPC) architecture for the Bus Tracking System, designed for high availability, security, and scalability with proper network segmentation.

## Architecture Overview

The VPC architecture follows AWS best practices with:
- **Multi-AZ deployment** for high availability
- **Public/Private subnet separation** for security
- **Dedicated subnets** for different service tiers
- **NAT Gateway** for secure outbound internet access
- **ElastiCache Redis** in private subnets
- **Lambda functions** in private subnets with VPC connectivity

---

## 1. Network Design & CIDR Allocation

### Primary VPC
- **VPC CIDR**: `10.0.0.0/16` (65,536 IP addresses)
- **Region**: ap-south-1 (Mumbai)
- **Availability Zones**: ap-south-1a, ap-south-1b

### Subnet Design

| Subnet Type | AZ | CIDR Block | IP Count | Purpose |
|-------------|----|-----------|-----------| --------|
| Public Subnet 1 | ap-south-1a | `10.0.1.0/24` | 256 | NAT Gateway, ALB, Bastion |
| Public Subnet 2 | ap-south-1b | `10.0.2.0/24` | 256 | NAT Gateway, ALB (Multi-AZ) |
| Private Subnet 1 | ap-south-1a | `10.0.10.0/24` | 256 | Lambda, ElastiCache |
| Private Subnet 2 | ap-south-1b | `10.0.11.0/24` | 256 | Lambda, ElastiCache (Multi-AZ) |
| Reserved | - | `10.0.3.0/24` - `10.0.9.0/24` | 1,792 | Future expansion |
| Reserved | - | `10.0.12.0/24` - `10.0.255.0/24` | 62,464 | Future use |

### CIDR Design Rationale

1. **10.0.0.0/16 VPC**: Provides ample address space for growth
2. **Public Subnets (10.0.1-2.0/24)**: Small ranges for infrastructure components
3. **Private Subnets (10.0.10-11.0/24)**: Larger ranges for application workloads
4. **Reserved Space**: Allows for additional tiers (DB subnets, management subnets)
5. **Multi-AZ**: Each subnet type spans two AZs for high availability

---

## 2. VPC Components

### Internet Gateway (IGW)
- **Purpose**: Provides internet access to public subnets
- **Attachment**: Attached to VPC
- **Route**: 0.0.0.0/0 → IGW in public route table

### NAT Gateways
- **NAT Gateway 1**: Public Subnet 1 (ap-south-1a)
- **NAT Gateway 2**: Public Subnet 2 (ap-south-1b)
- **Purpose**: Outbound internet access for private subnets
- **High Availability**: One NAT Gateway per AZ

### Route Tables

#### Public Route Table
```
Destination     Target
10.0.0.0/16    Local
0.0.0.0/0      IGW
```
**Associated Subnets**: Public Subnet 1, Public Subnet 2

#### Private Route Table 1 (AZ-1a)
```
Destination     Target
10.0.0.0/16    Local
0.0.0.0/0      NAT Gateway 1
```
**Associated Subnets**: Private Subnet 1

#### Private Route Table 2 (AZ-1b)
```
Destination     Target
10.0.0.0/16    Local
0.0.0.0/0      NAT Gateway 2
```
**Associated Subnets**: Private Subnet 2

---

## 3. Security Groups

### Lambda Security Group
```yaml
Ingress Rules:
  - Protocol: TCP, Port: 80, Source: ALB Security Group (HTTP from ALB)
  - Protocol: TCP, Port: 443, Source: ALB Security Group (HTTPS from ALB)

Egress Rules:
  - Protocol: TCP, Port: 6379, Destination: ElastiCache Security Group (Redis)
  - Protocol: TCP, Port: 443, Destination: 0.0.0.0/0 (HTTPS - DynamoDB, APIs)
  - Protocol: TCP, Port: 80, Destination: 0.0.0.0/0 (HTTP - if needed)
  - Protocol: ALL, Destination: 0.0.0.0/0 (All outbound traffic for Lambda)
```

### ElastiCache Security Group
```yaml
Ingress Rules:
  - Protocol: TCP, Port: 6379, Source: Lambda Security Group

Egress Rules:
  - None (ElastiCache doesn't initiate outbound connections)
```

### ALB Security Group (if using ALB)
```yaml
Ingress Rules:
  - Protocol: TCP, Port: 80, Source: 0.0.0.0/0 (HTTP from internet)
  - Protocol: TCP, Port: 443, Source: 0.0.0.0/0 (HTTPS from internet)

Egress Rules:
  - Protocol: TCP, Port: 80, Destination: Lambda Security Group (HTTP to Lambda)
  - Protocol: TCP, Port: 443, Destination: Lambda Security Group (HTTPS to Lambda)

Note: ALB→Lambda integration requires additional permissions:
- Lambda:InvokeFunction permission for ALB service
- Target Group configuration for Lambda functions
- ALB listeners with appropriate rules and actions
```

---

## 4. Service Placement

### ElastiCache Redis Cluster
- **Subnets**: Private Subnet 1 & 2 (Multi-AZ)
- **Subnet Group**: Create ElastiCache subnet group with both private subnets
- **Security**: ElastiCache Security Group
- **Configuration**:
  ```yaml
  Engine: Redis
  Node Type: cache.t3.micro (dev) / cache.r6g.large (prod)
  Multi-AZ: Enabled
  Subnet Group: bus-tracking-redis-subnet-group
  ```

### Lambda Functions
- **Subnets**: Private Subnet 1 & 2
- **Security**: Lambda Security Group
- **VPC Configuration**:
  ```yaml
  VpcConfig:
    SecurityGroupIds:
      - !Ref LambdaSecurityGroup
    SubnetIds:
      - !Ref PrivateSubnet1
      - !Ref PrivateSubnet2
  ```

### Application Load Balancer (Optional)
- **Subnets**: Public Subnet 1 & 2
- **Security**: ALB Security Group
- **Scheme**: Internet-facing
- **Target**: Lambda functions via ALB-Lambda integration

#### ALB-Lambda Integration Requirements
For proper ALB→Lambda integration, you need:

1. **Lambda Permissions**: Allow ALB to invoke Lambda functions
   ```yaml
   LambdaInvokePermission:
     Type: AWS::Lambda::Permission
     Properties:
       FunctionName: !Ref LambdaFunction
       Action: lambda:InvokeFunction
       Principal: elasticloadbalancing.amazonaws.com
   ```

2. **Target Group Configuration**: 
   ```yaml
   LambdaTargetGroup:
     Type: AWS::ElasticLoadBalancingV2::TargetGroup
     Properties:
       TargetType: lambda
       Targets:
         - Id: !GetAtt LambdaFunction.Arn
   ```

3. **ALB Listener Rules**: Configure listeners to route traffic to Lambda target groups

**Note**: ALB→Lambda communication is not traditional TCP traffic through security groups, but uses AWS service-to-service communication with proper IAM permissions.

---

## 5. Serverless.yml VPC Configuration

Add this to your `serverless.yml` under the `resources` section:

```yaml
resources:
  Resources:
    # VPC
    VPC:
      Type: AWS::EC2::VPC
      Properties:
        CidrBlock: 10.0.0.0/16
        EnableDnsHostnames: true
        EnableDnsSupport: true
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-vpc

    # Internet Gateway
    InternetGateway:
      Type: AWS::EC2::InternetGateway
      Properties:
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-igw

    InternetGatewayAttachment:
      Type: AWS::EC2::VPCGatewayAttachment
      Properties:
        VpcId: !Ref VPC
        InternetGatewayId: !Ref InternetGateway

    # Public Subnets
    PublicSubnet1:
      Type: AWS::EC2::Subnet
      Properties:
        VpcId: !Ref VPC
        AvailabilityZone: ${self:provider.region}a
        CidrBlock: 10.0.1.0/24
        MapPublicIpOnLaunch: true
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-public-subnet-1

    PublicSubnet2:
      Type: AWS::EC2::Subnet
      Properties:
        VpcId: !Ref VPC
        AvailabilityZone: ${self:provider.region}b
        CidrBlock: 10.0.2.0/24
        MapPublicIpOnLaunch: true
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-public-subnet-2

    # Private Subnets
    PrivateSubnet1:
      Type: AWS::EC2::Subnet
      Properties:
        VpcId: !Ref VPC
        AvailabilityZone: ${self:provider.region}a
        CidrBlock: 10.0.10.0/24
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-private-subnet-1

    PrivateSubnet2:
      Type: AWS::EC2::Subnet
      Properties:
        VpcId: !Ref VPC
        AvailabilityZone: ${self:provider.region}b
        CidrBlock: 10.0.11.0/24
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-private-subnet-2

    # NAT Gateways
    NatGateway1EIP:
      Type: AWS::EC2::EIP
      DependsOn: InternetGatewayAttachment
      Properties:
        Domain: vpc

    NatGateway2EIP:
      Type: AWS::EC2::EIP
      DependsOn: InternetGatewayAttachment
      Properties:
        Domain: vpc

    NatGateway1:
      Type: AWS::EC2::NatGateway
      Properties:
        AllocationId: !GetAtt NatGateway1EIP.AllocationId
        SubnetId: !Ref PublicSubnet1
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-nat-gateway-1

    NatGateway2:
      Type: AWS::EC2::NatGateway
      Properties:
        AllocationId: !GetAtt NatGateway2EIP.AllocationId
        SubnetId: !Ref PublicSubnet2
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-nat-gateway-2

    # Route Tables
    PublicRouteTable:
      Type: AWS::EC2::RouteTable
      Properties:
        VpcId: !Ref VPC
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-public-routes

    DefaultPublicRoute:
      Type: AWS::EC2::Route
      DependsOn: InternetGatewayAttachment
      Properties:
        RouteTableId: !Ref PublicRouteTable
        DestinationCidrBlock: 0.0.0.0/0
        GatewayId: !Ref InternetGateway

    PublicSubnet1RouteTableAssociation:
      Type: AWS::EC2::SubnetRouteTableAssociation
      Properties:
        RouteTableId: !Ref PublicRouteTable
        SubnetId: !Ref PublicSubnet1

    PublicSubnet2RouteTableAssociation:
      Type: AWS::EC2::SubnetRouteTableAssociation
      Properties:
        RouteTableId: !Ref PublicRouteTable
        SubnetId: !Ref PublicSubnet2

    PrivateRouteTable1:
      Type: AWS::EC2::RouteTable
      Properties:
        VpcId: !Ref VPC
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-private-routes-1

    DefaultPrivateRoute1:
      Type: AWS::EC2::Route
      Properties:
        RouteTableId: !Ref PrivateRouteTable1
        DestinationCidrBlock: 0.0.0.0/0
        NatGatewayId: !Ref NatGateway1

    PrivateSubnet1RouteTableAssociation:
      Type: AWS::EC2::SubnetRouteTableAssociation
      Properties:
        RouteTableId: !Ref PrivateRouteTable1
        SubnetId: !Ref PrivateSubnet1

    PrivateRouteTable2:
      Type: AWS::EC2::RouteTable
      Properties:
        VpcId: !Ref VPC
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-private-routes-2

    DefaultPrivateRoute2:
      Type: AWS::EC2::Route
      Properties:
        RouteTableId: !Ref PrivateRouteTable2
        DestinationCidrBlock: 0.0.0.0/0
        NatGatewayId: !Ref NatGateway2

    PrivateSubnet2RouteTableAssociation:
      Type: AWS::EC2::SubnetRouteTableAssociation
      Properties:
        RouteTableId: !Ref PrivateRouteTable2
        SubnetId: !Ref PrivateSubnet2

    # Security Groups
    LambdaSecurityGroup:
      Type: AWS::EC2::SecurityGroup
      Properties:
        GroupDescription: Security group for Lambda functions
        VpcId: !Ref VPC
        SecurityGroupIngress:
          - IpProtocol: tcp
            FromPort: 80
            ToPort: 80
            SourceSecurityGroupId: !Ref ALBSecurityGroup
            Description: HTTP from ALB
          - IpProtocol: tcp
            FromPort: 443
            ToPort: 443
            SourceSecurityGroupId: !Ref ALBSecurityGroup
            Description: HTTPS from ALB
        SecurityGroupEgress:
          - IpProtocol: tcp
            FromPort: 6379
            ToPort: 6379
            DestinationSecurityGroupId: !Ref ElastiCacheSecurityGroup
            Description: Redis access
          - IpProtocol: tcp
            FromPort: 443
            ToPort: 443
            CidrIp: 0.0.0.0/0
            Description: HTTPS outbound (DynamoDB, APIs)
          - IpProtocol: tcp
            FromPort: 80
            ToPort: 80
            CidrIp: 0.0.0.0/0
            Description: HTTP outbound
          - IpProtocol: -1
            CidrIp: 0.0.0.0/0
            Description: All outbound traffic for Lambda operations
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-lambda-sg

    ALBSecurityGroup:
      Type: AWS::EC2::SecurityGroup
      Properties:
        GroupDescription: Security group for Application Load Balancer
        VpcId: !Ref VPC
        SecurityGroupIngress:
          - IpProtocol: tcp
            FromPort: 80
            ToPort: 80
            CidrIp: 0.0.0.0/0
            Description: HTTP from internet
          - IpProtocol: tcp
            FromPort: 443
            ToPort: 443
            CidrIp: 0.0.0.0/0
            Description: HTTPS from internet
        SecurityGroupEgress:
          - IpProtocol: tcp
            FromPort: 80
            ToPort: 80
            DestinationSecurityGroupId: !Ref LambdaSecurityGroup
            Description: HTTP to Lambda functions
          - IpProtocol: tcp
            FromPort: 443
            ToPort: 443
            DestinationSecurityGroupId: !Ref LambdaSecurityGroup
            Description: HTTPS to Lambda functions
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-alb-sg

    ElastiCacheSecurityGroup:
      Type: AWS::EC2::SecurityGroup
      Properties:
        GroupDescription: Security group for ElastiCache Redis
        VpcId: !Ref VPC
        SecurityGroupIngress:
          - IpProtocol: tcp
            FromPort: 6379
            ToPort: 6379
            SourceSecurityGroupId: !Ref LambdaSecurityGroup
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-elasticache-sg

    # ElastiCache Subnet Group
    ElastiCacheSubnetGroup:
      Type: AWS::ElastiCache::SubnetGroup
      Properties:
        Description: Subnet group for ElastiCache Redis
        SubnetIds:
          - !Ref PrivateSubnet1
          - !Ref PrivateSubnet2

    # ElastiCache Redis Cluster
    ElastiCacheCluster:
      Type: AWS::ElastiCache::ReplicationGroup
      Properties:
        ReplicationGroupId: ${self:service}-${opt:stage}-redis
        Description: Redis cluster for bus tracking system
        Engine: redis
        CacheNodeType: cache.t3.micro
        NumCacheClusters: 2
        AutomaticFailoverEnabled: true
        MultiAZEnabled: true
        SecurityGroupIds:
          - !Ref ElastiCacheSecurityGroup
        CacheSubnetGroupName: !Ref ElastiCacheSubnetGroup
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-redis

    # Application Load Balancer (Optional)
    ApplicationLoadBalancer:
      Type: AWS::ElasticLoadBalancingV2::LoadBalancer
      Properties:
        Name: ${self:service}-${opt:stage}-alb
        Type: application
        Scheme: internet-facing
        SecurityGroups:
          - !Ref ALBSecurityGroup
        Subnets:
          - !Ref PublicSubnet1
          - !Ref PublicSubnet2
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-alb

    # ALB Listener
    ALBListener:
      Type: AWS::ElasticLoadBalancingV2::Listener
      Properties:
        DefaultActions:
          - Type: forward
            TargetGroupArn: !Ref LambdaTargetGroup
        LoadBalancerArn: !Ref ApplicationLoadBalancer
        Port: 80
        Protocol: HTTP

    # Lambda Target Group
    LambdaTargetGroup:
      Type: AWS::ElasticLoadBalancingV2::TargetGroup
      Properties:
        Name: ${self:service}-${opt:stage}-lambda-tg
        TargetType: lambda
        Targets:
          - Id: !GetAtt GetRoutesFunction.Arn  # Reference your Lambda function

    # Lambda Permission for ALB
    LambdaALBPermission:
      Type: AWS::Lambda::Permission
      Properties:
        FunctionName: !Ref GetRoutesFunction  # Reference your Lambda function
        Action: lambda:InvokeFunction
        Principal: elasticloadbalancing.amazonaws.com
        SourceArn: !Sub "${ApplicationLoadBalancer}/*/

  Outputs:
    VPCId:
      Description: VPC ID
      Value: !Ref VPC
      Export:
        Name: ${self:service}-${opt:stage}-vpc-id

    PrivateSubnet1Id:
      Description: Private Subnet 1 ID
      Value: !Ref PrivateSubnet1
      Export:
        Name: ${self:service}-${opt:stage}-private-subnet-1

    PrivateSubnet2Id:
      Description: Private Subnet 2 ID
      Value: !Ref PrivateSubnet2
      Export:
        Name: ${self:service}-${opt:stage}-private-subnet-2

    LambdaSecurityGroupId:
      Description: Lambda Security Group ID
      Value: !Ref LambdaSecurityGroup
      Export:
        Name: ${self:service}-${opt:stage}-lambda-sg

    RedisEndpoint:
      Description: Redis cluster endpoint
      Value: !GetAtt ElastiCacheCluster.RedisEndpoint.Address
      Export:
        Name: ${self:service}-${opt:stage}-redis-endpoint

    RedisPort:
      Description: Redis cluster port
      Value: !GetAtt ElastiCacheCluster.RedisEndpoint.Port
      Export:
        Name: ${self:service}-${opt:stage}-redis-port

    ALBDNSName:
      Description: Application Load Balancer DNS name
      Value: !GetAtt ApplicationLoadBalancer.DNSName
      Export:
        Name: ${self:service}-${opt:stage}-alb-dns

    ALBHostedZoneId:
      Description: Application Load Balancer hosted zone ID
      Value: !GetAtt ApplicationLoadBalancer.CanonicalHostedZoneID
      Export:
        Name: ${self:service}-${opt:stage}-alb-zone
```

---

## 6. Lambda VPC Configuration

Update your Lambda functions to use the VPC:

```yaml
provider:
  vpc:
    securityGroupIds:
      - !Ref LambdaSecurityGroup
    subnetIds:
      - !Ref PrivateSubnet1
      - !Ref PrivateSubnet2

functions:
  getRoutes:
    handler: src/handlers/routes.getRoutes
    # VPC configuration inherited from provider
    
  updateLocation:
    handler: src/handlers/location.updateLocation
    # VPC configuration inherited from provider
```

---

## 7. Cost Considerations

### NAT Gateway Costs
- **Data Processing**: $0.045 per GB (ap-south-1)
- **Hourly Charges**: $0.045 per hour per NAT Gateway
- **Monthly Cost**: ~$32.85/month per NAT Gateway (2 gateways = ~$65.70/month)

### Cost Optimization Options
1. **Single NAT Gateway**: Use one NAT Gateway for dev environments
2. **NAT Instance**: Use EC2 NAT instance for lower cost (manual management)
3. **VPC Endpoints**: Use VPC endpoints for DynamoDB to avoid NAT Gateway charges

### Development Environment Optimization
```yaml
# Single NAT Gateway for dev
NatGateway1:
  Type: AWS::EC2::NatGateway
  Condition: IsProduction  # Only create in production

# Use single route table for both private subnets in dev
PrivateSubnet2RouteTableAssociation:
  Type: AWS::EC2::SubnetRouteTableAssociation
  Properties:
    RouteTableId: !Ref PrivateRouteTable1  # Reuse route table 1
    SubnetId: !Ref PrivateSubnet2
```

---

## 8. Deployment Strategy

### Phase 1: Infrastructure Only
1. Deploy VPC, subnets, gateways, and security groups
2. Test connectivity and routing

### Phase 2: ElastiCache Integration
1. Deploy ElastiCache cluster
2. Update Lambda functions with VPC configuration
3. Test Redis connectivity from Lambda

### Phase 3: Production Optimization
1. Enable VPC Flow Logs
2. Set up CloudWatch monitoring
3. Implement VPC endpoints for cost optimization

---

## 9. Security Best Practices

### Network Security
- **Private Subnets**: No direct internet access for Lambda/Redis
- **Security Groups**: Principle of least privilege
- **NACLs**: Additional layer of security (default allows all)

### Monitoring
- **VPC Flow Logs**: Monitor network traffic
- **CloudTrail**: Log VPC API calls
- **CloudWatch**: Monitor NAT Gateway metrics

### Access Control
- **No SSH Access**: Serverless architecture eliminates SSH needs
- **Bastion Host**: Only if administrative access is required
- **VPC Endpoints**: Secure access to AWS services

---

## 11. Security Group Configuration Notes

### Important Corrections Made

1. **Lambda Security Group**:
   - **Ingress**: Added rules to allow inbound traffic from ALB (ports 80/443)
   - **Egress**: Fixed to use `DestinationSecurityGroupId` instead of `SourceSecurityGroupId`
   - **Egress**: Added comprehensive outbound rules for Redis, HTTPS, and general Lambda operations

2. **ALB Security Group**:
   - **Ingress**: Allows HTTP/HTTPS from internet (0.0.0.0/0)
   - **Egress**: Uses correct `DestinationSecurityGroupId` to reference Lambda SG

3. **Redis Security Group**:
   - **Ingress**: Correctly configured to allow port 6379 from Lambda SG
   - **Egress**: No egress rules needed (Redis doesn't initiate outbound connections)

### ALB-Lambda Integration Requirements

**Important**: ALB→Lambda integration is not pure TCP traffic through security groups. It requires:

1. **IAM Permissions**: `lambda:InvokeFunction` permission for ALB service
2. **Target Groups**: Lambda-type target groups with function ARNs
3. **Listeners**: ALB listeners configured to forward to Lambda target groups
4. **Security Groups**: While not strictly required for ALB-Lambda communication, they provide defense in depth

### Security Group Rules Syntax

- **Ingress Rules**: Use `SourceSecurityGroupId` to reference source security groups
- **Egress Rules**: Use `DestinationSecurityGroupId` to reference destination security groups
- **CIDR Rules**: Use `CidrIp` for IP-based rules (both ingress and egress)

---

## 12. Troubleshooting Guide

### Common Issues
1. **Lambda Cold Starts**: VPC Lambdas have longer cold starts
2. **ENI Limits**: Monitor ENI usage in VPC
3. **NAT Gateway Bandwidth**: Monitor data transfer limits

### Testing Connectivity
```bash
# Test from Lambda (via CloudWatch Logs)
telnet redis-endpoint 6379

# Test NAT Gateway (via Lambda)
curl -I https://aws.amazon.com
```

### Performance Optimization
- **Provisioned Concurrency**: Reduce VPC Lambda cold starts
- **Connection Pooling**: Reuse Redis connections
- **VPC Endpoints**: Direct access to DynamoDB/S3

---

This VPC architecture provides a secure, scalable, and highly available foundation for the Bus Tracking System with proper network segmentation and AWS best practices.