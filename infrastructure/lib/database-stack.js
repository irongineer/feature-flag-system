"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
class DatabaseStack extends cdk.Stack {
    featureFlagsTable;
    envName;
    constructor(scope, id, props) {
        super(scope, id, props);
        this.envName = props.stackName;
        // メインテーブル: フラグ定義、テナントオーバーライド、Kill-Switch
        this.featureFlagsTable = new dynamodb.Table(this, 'FeatureFlagsTable', {
            tableName: `feature-flags-${this.envName.toLowerCase()}`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // 開発環境用
            pointInTimeRecovery: true,
            stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
            // 暗号化設定
            encryption: dynamodb.TableEncryption.AWS_MANAGED
        });
        // GSI1: 有効期限でのクエリ用
        this.featureFlagsTable.addGlobalSecondaryIndex({
            indexName: 'GSI1',
            partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // GSI2: フラグ別のテナント一覧用
        this.featureFlagsTable.addGlobalSecondaryIndex({
            indexName: 'GSI2',
            partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 監査ログテーブル
        const auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
            tableName: `feature-flags-audit-${this.stackName.toLowerCase()}`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // "AUDIT#${timestamp}"
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // "ACTION#${actionId}"
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            timeToLiveAttribute: 'ttl' // 90日後に自動削除
        });
        // GSI: ユーザー別の監査ログ検索用
        auditLogTable.addGlobalSecondaryIndex({
            indexName: 'UserIndex',
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });
        // 出力
        new cdk.CfnOutput(this, 'FeatureFlagsTableName', {
            value: this.featureFlagsTable.tableName,
            description: 'Feature flags table name',
        });
        new cdk.CfnOutput(this, 'FeatureFlagsTableArn', {
            value: this.featureFlagsTable.tableArn,
            description: 'Feature flags table ARN',
        });
        new cdk.CfnOutput(this, 'AuditLogTableName', {
            value: auditLogTable.tableName,
            description: 'Audit log table name',
        });
    }
}
exports.DatabaseStack = DatabaseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJkYXRhYmFzZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsbUVBQXFEO0FBT3JELE1BQWEsYUFBYyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzFCLGlCQUFpQixDQUFpQjtJQUNqQyxPQUFPLENBQVM7SUFFakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7UUFFL0IseUNBQXlDO1FBQ3pDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFO1lBQ3JFLFNBQVMsRUFBRSxpQkFBaUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsRUFBRTtZQUN4RCxZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUNqRSxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUM1RCxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU8sRUFBRSxRQUFRO1lBQ2xELG1CQUFtQixFQUFFLElBQUk7WUFDekIsTUFBTSxFQUFFLFFBQVEsQ0FBQyxjQUFjLENBQUMsa0JBQWtCO1lBRWxELFFBQVE7WUFDUixVQUFVLEVBQUUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxXQUFXO1NBQ2pE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ZGstbGliJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBEYXRhYmFzZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWNrTmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGF0YWJhc2VTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBmZWF0dXJlRmxhZ3NUYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIHByaXZhdGUgcmVhZG9ubHkgZW52TmFtZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBEYXRhYmFzZVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcbiAgICB0aGlzLmVudk5hbWUgPSBwcm9wcy5zdGFja05hbWU7XG5cbiAgICAvLyDjg6HjgqTjg7Pjg4bjg7zjg5bjg6s6IOODleODqeOCsOWumue+qeOAgeODhuODiuODs+ODiOOCquODvOODkOODvOODqeOCpOODieOAgUtpbGwtU3dpdGNoXG4gICAgdGhpcy5mZWF0dXJlRmxhZ3NUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnRmVhdHVyZUZsYWdzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6IGBmZWF0dXJlLWZsYWdzLSR7dGhpcy5lbnZOYW1lLnRvTG93ZXJDYXNlKCl9YCxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnUEsnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnU0snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksIC8vIOmWi+eZuueSsOWig+eUqFxuICAgICAgcG9pbnRJblRpbWVSZWNvdmVyeTogdHJ1ZSxcbiAgICAgIHN0cmVhbTogZHluYW1vZGIuU3RyZWFtVmlld1R5cGUuTkVXX0FORF9PTERfSU1BR0VTLFxuICAgICAgXG4gICAgICAvLyDmmpflj7fljJboqK3lrppcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRFxuICAgIH0pO1xuXG4gICAgLy8gR1NJMTog5pyJ5Yq55pyf6ZmQ44Gn44Gu44Kv44Ko44Oq55SoXG4gICAgdGhpcy5mZWF0dXJlRmxhZ3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kxJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMVBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTFTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8gR1NJMjog44OV44Op44Kw5Yil44Gu44OG44OK44Oz44OI5LiA6Kan55SoXG4gICAgdGhpcy5mZWF0dXJlRmxhZ3NUYWJsZS5hZGRHbG9iYWxTZWNvbmRhcnlJbmRleCh7XG4gICAgICBpbmRleE5hbWU6ICdHU0kyJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAnR1NJMlBLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ0dTSTJTSycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8g55uj5p+744Ot44Kw44OG44O844OW44OrXG4gICAgY29uc3QgYXVkaXRMb2dUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnQXVkaXRMb2dUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogYGZlYXR1cmUtZmxhZ3MtYXVkaXQtJHt0aGlzLnN0YWNrTmFtZS50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ1BLJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSwgLy8gXCJBVURJVCMke3RpbWVzdGFtcH1cIlxuICAgICAgc29ydEtleTogeyBuYW1lOiAnU0snLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LCAvLyBcIkFDVElPTiMke2FjdGlvbklkfVwiXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICd0dGwnIC8vIDkw5pel5b6M44Gr6Ieq5YuV5YmK6ZmkXG4gICAgfSk7XG5cbiAgICAvLyBHU0k6IOODpuODvOOCtuODvOWIpeOBruebo+afu+ODreOCsOaknOe0oueUqFxuICAgIGF1ZGl0TG9nVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAnVXNlckluZGV4JyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAndXNlcklkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3RpbWVzdGFtcCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBwcm9qZWN0aW9uVHlwZTogZHluYW1vZGIuUHJvamVjdGlvblR5cGUuQUxMLFxuICAgIH0pO1xuXG4gICAgLy8g5Ye65YqbXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0ZlYXR1cmVGbGFnc1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZlYXR1cmVGbGFnc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRmVhdHVyZSBmbGFncyB0YWJsZSBuYW1lJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGZWF0dXJlRmxhZ3NUYWJsZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmZlYXR1cmVGbGFnc1RhYmxlLnRhYmxlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdGZWF0dXJlIGZsYWdzIHRhYmxlIEFSTicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVkaXRMb2dUYWJsZU5hbWUnLCB7XG4gICAgICB2YWx1ZTogYXVkaXRMb2dUYWJsZS50YWJsZU5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0F1ZGl0IGxvZyB0YWJsZSBuYW1lJyxcbiAgICB9KTtcbiAgfVxufSJdfQ==