#!/usr/bin/env node
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const database_stack_1 = require("../lib/database-stack");
const lambda_stack_1 = require("../lib/lambda-stack");
const monitoring_stack_1 = require("../lib/monitoring-stack");
const app = new cdk.App();
// 環境設定
const devEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-1',
};
const prodEnv = {
    account: process.env.CDK_PROD_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_PROD_REGION || 'ap-northeast-1',
};
// 開発環境
const devDatabaseStack = new database_stack_1.DatabaseStack(app, 'FeatureFlagDevDatabaseStack', {
    env: devEnv,
    stackName: 'Dev',
    tags: {
        Environment: 'Development',
        Service: 'FeatureFlag',
    },
});
const devLambdaStack = new lambda_stack_1.LambdaStack(app, 'FeatureFlagDevLambdaStack', {
    env: devEnv,
    stackName: 'Dev',
    featureFlagsTable: devDatabaseStack.featureFlagsTable,
    tags: {
        Environment: 'Development',
        Service: 'FeatureFlag',
    },
});
const devMonitoringStack = new monitoring_stack_1.MonitoringStack(app, 'FeatureFlagDevMonitoringStack', {
    env: devEnv,
    stackName: 'Dev',
    featureFlagsTable: devDatabaseStack.featureFlagsTable,
    api: devLambdaStack.api,
    tags: {
        Environment: 'Development',
        Service: 'FeatureFlag',
    },
});
// 本番環境
const prodDatabaseStack = new database_stack_1.DatabaseStack(app, 'FeatureFlagProdDatabaseStack', {
    env: prodEnv,
    stackName: 'Prod',
    tags: {
        Environment: 'Production',
        Service: 'FeatureFlag',
    },
});
const prodLambdaStack = new lambda_stack_1.LambdaStack(app, 'FeatureFlagProdLambdaStack', {
    env: prodEnv,
    stackName: 'Prod',
    featureFlagsTable: prodDatabaseStack.featureFlagsTable,
    tags: {
        Environment: 'Production',
        Service: 'FeatureFlag',
    },
});
const prodMonitoringStack = new monitoring_stack_1.MonitoringStack(app, 'FeatureFlagProdMonitoringStack', {
    env: prodEnv,
    stackName: 'Prod',
    featureFlagsTable: prodDatabaseStack.featureFlagsTable,
    api: prodLambdaStack.api,
    tags: {
        Environment: 'Production',
        Service: 'FeatureFlag',
    },
});
// 依存関係の設定
devLambdaStack.node.addDependency(devDatabaseStack);
devMonitoringStack.node.addDependency(devLambdaStack);
prodLambdaStack.node.addDependency(prodDatabaseStack);
prodMonitoringStack.node.addDependency(prodLambdaStack);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsMERBQXNEO0FBQ3RELHNEQUFrRDtBQUNsRCw4REFBMEQ7QUFFMUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsT0FBTztBQUNQLE1BQU0sTUFBTSxHQUFHO0lBQ2IsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLGdCQUFnQjtDQUMzRCxDQUFDO0FBRUYsTUFBTSxPQUFPLEdBQUc7SUFDZCxPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4RSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxlQUFlLElBQUksZ0JBQWdCO0NBQ3hELENBQUM7QUFFRixPQUFPO0FBQ1AsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLDhCQUFhLENBQUMsR0FBRyxFQUFFLDZCQUE2QixFQUFFO0lBQzdFLEdBQUcsRUFBRSxNQUFNO0lBQ1gsU0FBUyxFQUFFLEtBQUs7SUFDaEIsSUFBSSxFQUFFO1FBQ0osV0FBVyxFQUFFLGFBQWE7UUFDMUIsT0FBTyxFQUFFLGFBQWE7S0FDdkI7Q0FDRixDQUFDLENBQUM7QUFFSCxNQUFNLGNBQWMsR0FBRyxJQUFJLDBCQUFXLENBQUMsR0FBRyxFQUFFLDJCQUEyQixFQUFFO0lBQ3ZFLEdBQUcsRUFBRSxNQUFNO0lBQ1gsU0FBUyxFQUFFLEtBQUs7SUFDaEIsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUMsaUJBQWlCO0lBQ3JELElBQUksRUFBRTtRQUNKLFdBQVcsRUFBRSxhQUFhO1FBQzFCLE9BQU8sRUFBRSxhQUFhO0tBQ3ZCO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLGtDQUFlLENBQUMsR0FBRyxFQUFFLCtCQUErQixFQUFFO0lBQ25GLEdBQUcsRUFBRSxNQUFNO0lBQ1gsU0FBUyxFQUFFLEtBQUs7SUFDaEIsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUMsaUJBQWlCO0lBQ3JELEdBQUcsRUFBRSxjQUFjLENBQUMsR0FBRztJQUN2QixJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsYUFBYTtRQUMxQixPQUFPLEVBQUUsYUFBYTtLQUN2QjtDQUNGLENBQUMsQ0FBQztBQUVILE9BQU87QUFDUCxNQUFNLGlCQUFpQixHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsOEJBQThCLEVBQUU7SUFDL0UsR0FBRyxFQUFFLE9BQU87SUFDWixTQUFTLEVBQUUsTUFBTTtJQUNqQixJQUFJLEVBQUU7UUFDSixXQUFXLEVBQUUsWUFBWTtRQUN6QixPQUFPLEVBQUUsYUFBYTtLQUN2QjtDQUNGLENBQUMsQ0FBQztBQUVILE1BQU0sZUFBZSxHQUFHLElBQUksMEJBQVcsQ0FBQyxHQUFHLEVBQUUsNEJBQTRCLEVBQUU7SUFDekUsR0FBRyxFQUFFLE9BQU87SUFDWixTQUFTLEVBQUUsTUFBTTtJQUNqQixpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQyxpQkFBaUI7SUFDdEQsSUFBSSxFQUFFO1FBQ0osV0FBVyxFQUFFLFlBQVk7UUFDekIsT0FBTyxFQUFFLGFBQWE7S0FDdkI7Q0FDRixDQUFDLENBQUM7QUFFSCxNQUFNLG1CQUFtQixHQUFHLElBQUksa0NBQWUsQ0FBQyxHQUFHLEVBQUUsZ0NBQWdDLEVBQUU7SUFDckYsR0FBRyxFQUFFLE9BQU87SUFDWixTQUFTLEVBQUUsTUFBTTtJQUNqQixpQkFBaUIsRUFBRSxpQkFBaUIsQ0FBQyxpQkFBaUI7SUFDdEQsR0FBRyxFQUFFLGVBQWUsQ0FBQyxHQUFHO0lBQ3hCLElBQUksRUFBRTtRQUNKLFdBQVcsRUFBRSxZQUFZO1FBQ3pCLE9BQU8sRUFBRSxhQUFhO0tBQ3ZCO0NBQ0YsQ0FBQyxDQUFDO0FBRUgsVUFBVTtBQUNWLGNBQWMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUFDcEQsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUV0RCxlQUFlLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ3RELG1CQUFtQixDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgRGF0YWJhc2VTdGFjayB9IGZyb20gJy4uL2xpYi9kYXRhYmFzZS1zdGFjayc7XG5pbXBvcnQgeyBMYW1iZGFTdGFjayB9IGZyb20gJy4uL2xpYi9sYW1iZGEtc3RhY2snO1xuaW1wb3J0IHsgTW9uaXRvcmluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL21vbml0b3Jpbmctc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyDnkrDlooPoqK3lrppcbmNvbnN0IGRldkVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ2FwLW5vcnRoZWFzdC0xJyxcbn07XG5cbmNvbnN0IHByb2RFbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19QUk9EX0FDQ09VTlQgfHwgcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfUFJPRF9SRUdJT04gfHwgJ2FwLW5vcnRoZWFzdC0xJyxcbn07XG5cbi8vIOmWi+eZuueSsOWig1xuY29uc3QgZGV2RGF0YWJhc2VTdGFjayA9IG5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgJ0ZlYXR1cmVGbGFnRGV2RGF0YWJhc2VTdGFjaycsIHtcbiAgZW52OiBkZXZFbnYsXG4gIHN0YWNrTmFtZTogJ0RldicsXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogJ0RldmVsb3BtZW50JyxcbiAgICBTZXJ2aWNlOiAnRmVhdHVyZUZsYWcnLFxuICB9LFxufSk7XG5cbmNvbnN0IGRldkxhbWJkYVN0YWNrID0gbmV3IExhbWJkYVN0YWNrKGFwcCwgJ0ZlYXR1cmVGbGFnRGV2TGFtYmRhU3RhY2snLCB7XG4gIGVudjogZGV2RW52LFxuICBzdGFja05hbWU6ICdEZXYnLFxuICBmZWF0dXJlRmxhZ3NUYWJsZTogZGV2RGF0YWJhc2VTdGFjay5mZWF0dXJlRmxhZ3NUYWJsZSxcbiAgdGFnczoge1xuICAgIEVudmlyb25tZW50OiAnRGV2ZWxvcG1lbnQnLFxuICAgIFNlcnZpY2U6ICdGZWF0dXJlRmxhZycsXG4gIH0sXG59KTtcblxuY29uc3QgZGV2TW9uaXRvcmluZ1N0YWNrID0gbmV3IE1vbml0b3JpbmdTdGFjayhhcHAsICdGZWF0dXJlRmxhZ0Rldk1vbml0b3JpbmdTdGFjaycsIHtcbiAgZW52OiBkZXZFbnYsXG4gIHN0YWNrTmFtZTogJ0RldicsXG4gIGZlYXR1cmVGbGFnc1RhYmxlOiBkZXZEYXRhYmFzZVN0YWNrLmZlYXR1cmVGbGFnc1RhYmxlLFxuICBhcGk6IGRldkxhbWJkYVN0YWNrLmFwaSxcbiAgdGFnczoge1xuICAgIEVudmlyb25tZW50OiAnRGV2ZWxvcG1lbnQnLFxuICAgIFNlcnZpY2U6ICdGZWF0dXJlRmxhZycsXG4gIH0sXG59KTtcblxuLy8g5pys55Wq55Kw5aKDXG5jb25zdCBwcm9kRGF0YWJhc2VTdGFjayA9IG5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgJ0ZlYXR1cmVGbGFnUHJvZERhdGFiYXNlU3RhY2snLCB7XG4gIGVudjogcHJvZEVudixcbiAgc3RhY2tOYW1lOiAnUHJvZCcsXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogJ1Byb2R1Y3Rpb24nLFxuICAgIFNlcnZpY2U6ICdGZWF0dXJlRmxhZycsXG4gIH0sXG59KTtcblxuY29uc3QgcHJvZExhbWJkYVN0YWNrID0gbmV3IExhbWJkYVN0YWNrKGFwcCwgJ0ZlYXR1cmVGbGFnUHJvZExhbWJkYVN0YWNrJywge1xuICBlbnY6IHByb2RFbnYsXG4gIHN0YWNrTmFtZTogJ1Byb2QnLFxuICBmZWF0dXJlRmxhZ3NUYWJsZTogcHJvZERhdGFiYXNlU3RhY2suZmVhdHVyZUZsYWdzVGFibGUsXG4gIHRhZ3M6IHtcbiAgICBFbnZpcm9ubWVudDogJ1Byb2R1Y3Rpb24nLFxuICAgIFNlcnZpY2U6ICdGZWF0dXJlRmxhZycsXG4gIH0sXG59KTtcblxuY29uc3QgcHJvZE1vbml0b3JpbmdTdGFjayA9IG5ldyBNb25pdG9yaW5nU3RhY2soYXBwLCAnRmVhdHVyZUZsYWdQcm9kTW9uaXRvcmluZ1N0YWNrJywge1xuICBlbnY6IHByb2RFbnYsXG4gIHN0YWNrTmFtZTogJ1Byb2QnLFxuICBmZWF0dXJlRmxhZ3NUYWJsZTogcHJvZERhdGFiYXNlU3RhY2suZmVhdHVyZUZsYWdzVGFibGUsXG4gIGFwaTogcHJvZExhbWJkYVN0YWNrLmFwaSxcbiAgdGFnczoge1xuICAgIEVudmlyb25tZW50OiAnUHJvZHVjdGlvbicsXG4gICAgU2VydmljZTogJ0ZlYXR1cmVGbGFnJyxcbiAgfSxcbn0pO1xuXG4vLyDkvp3lrZjplqLkv4Ljga7oqK3lrppcbmRldkxhbWJkYVN0YWNrLm5vZGUuYWRkRGVwZW5kZW5jeShkZXZEYXRhYmFzZVN0YWNrKTtcbmRldk1vbml0b3JpbmdTdGFjay5ub2RlLmFkZERlcGVuZGVuY3koZGV2TGFtYmRhU3RhY2spO1xuXG5wcm9kTGFtYmRhU3RhY2subm9kZS5hZGREZXBlbmRlbmN5KHByb2REYXRhYmFzZVN0YWNrKTtcbnByb2RNb25pdG9yaW5nU3RhY2subm9kZS5hZGREZXBlbmRlbmN5KHByb2RMYW1iZGFTdGFjayk7Il19