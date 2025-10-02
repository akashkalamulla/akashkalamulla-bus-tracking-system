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
  - None (Lambda doesn't accept inbound connections)

Egress Rules:
  - Protocol: TCP, Port: 6379, Source: ElastiCache Security Group (Redis)
  - Protocol: TCP, Port: 443, Source: 0.0.0.0/0 (HTTPS - DynamoDB, APIs)
  - Protocol: TCP, Port: 80, Source: 0.0.0.0/0 (HTTP - if needed)
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
  - Protocol: TCP, Port: 80, Source: 0.0.0.0/0
  - Protocol: TCP, Port: 443, Source: 0.0.0.0/0

Egress Rules:
  - Protocol: TCP, Port: 80, Source: Lambda Security Group
  - Protocol: TCP, Port: 443, Source: Lambda Security Group
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
        SecurityGroupEgress:
          - IpProtocol: tcp
            FromPort: 6379
            ToPort: 6379
            SourceSecurityGroupId: !Ref ElastiCacheSecurityGroup
          - IpProtocol: tcp
            FromPort: 443
            ToPort: 443
            CidrIp: 0.0.0.0/0
          - IpProtocol: tcp
            FromPort: 80
            ToPort: 80
            CidrIp: 0.0.0.0/0
        Tags:
          - Key: Name
            Value: ${self:service}-${opt:stage}-lambda-sg

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

## 10. Troubleshooting Guide

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