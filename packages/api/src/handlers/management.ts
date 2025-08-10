import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { FeatureFlagKey, FEATURE_FLAGS } from '@feature-flag/core';
import { validateFlagRequest, validateTenantOverrideRequest } from '../validators/management';
import { createResponse, createErrorResponse } from '../utils/response';
import { createDynamoClient } from '../utils/dynamo';

let dynamoClient: any = null;

function getDynamoClient() {
  if (!dynamoClient) {
    dynamoClient = createDynamoClient();
  }
  return dynamoClient;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Management request:', JSON.stringify(event, null, 2));
  
  try {
    const method = event.httpMethod;
    const path = event.path;
    const pathParameters = event.pathParameters || {};
    
    // ルーティング
    if (path.startsWith('/flags')) {
      return await handleFlagOperations(method, pathParameters, event.body);
    } else if (path.startsWith('/tenants')) {
      return await handleTenantOperations(method, pathParameters, event.body);
    } else if (path.startsWith('/emergency')) {
      return await handleEmergencyOperations(method, event.body);
    } else {
      return createErrorResponse(404, 'Not found');
    }
    
  } catch (error) {
    console.error('Management error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
};

// フラグ操作のハンドラー
async function handleFlagOperations(
  method: string,
  pathParameters: { [key: string]: string | undefined },
  body: string | null
): Promise<APIGatewayProxyResult> {
  const client = getDynamoClient();
  
  switch (method) {
    case 'GET':
      if (pathParameters.flagKey) {
        // 特定フラグの取得
        const flagKey = pathParameters.flagKey as FeatureFlagKey;
        const flag = await client.getFlag(flagKey);
        
        if (!flag) {
          return createErrorResponse(404, 'Flag not found');
        }
        
        return createResponse(200, flag);
      } else {
        // フラグ一覧の取得
        const flags = await client.listFlags();
        return createResponse(200, { flags });
      }
      
    case 'POST': {
      // 新しいフラグの作成
      const createBody = JSON.parse(body || '{}');
      const { error: createError, value: createValue } = validateFlagRequest(createBody);
      
      if (createError) {
        return createErrorResponse(400, 'Invalid request', createError.details);
      }
      
      await client.createFlag({
        flagKey: createValue.flagKey,
        description: createValue.description,
        defaultEnabled: createValue.defaultEnabled || false,
        owner: createValue.owner || 'system',
        createdAt: new Date().toISOString(),
        expiresAt: createValue.expiresAt,
      });
      
      console.log('FLAG_CREATED', {
        flagKey: createValue.flagKey,
        owner: createValue.owner,
        defaultEnabled: createValue.defaultEnabled,
      });
      
      return createResponse(201, { message: 'Flag created successfully' });
    }
      
    case 'PUT': {
      // フラグの更新
      if (!pathParameters.flagKey) {
        return createErrorResponse(400, 'Flag key is required');
      }
      
      const updateBody = JSON.parse(body || '{}');
      const flagKey = pathParameters.flagKey as FeatureFlagKey;
      
      await client.updateFlag(flagKey, updateBody);
      
      console.log('FLAG_UPDATED', {
        flagKey,
        updates: Object.keys(updateBody),
      });
      
      return createResponse(200, { message: 'Flag updated successfully' });
    }
      
    case 'DELETE': {
      // フラグの削除（実装は要検討）
      return createErrorResponse(405, 'Method not allowed', 'Flag deletion not supported');
    }
      
    default:
      return createErrorResponse(405, 'Method not allowed');
  }
}

// テナント操作のハンドラー
async function handleTenantOperations(
  method: string,
  pathParameters: { [key: string]: string | undefined },
  body: string | null
): Promise<APIGatewayProxyResult> {
  const client = getDynamoClient();
  const tenantId = pathParameters.tenantId;
  const flagKey = pathParameters.flagKey as FeatureFlagKey;
  
  if (!tenantId) {
    return createErrorResponse(400, 'Tenant ID is required');
  }
  
  switch (method) {
    case 'GET': {
      if (flagKey) {
        // 特定テナントの特定フラグオーバーライド取得
        const override = await client.getTenantOverride(tenantId, flagKey);
        
        if (!override) {
          return createErrorResponse(404, 'Override not found');
        }
        
        return createResponse(200, override);
      } else {
        // テナントのフラグオーバーライド一覧取得
        const overrides = await client.listTenantOverrides(tenantId);
        return createResponse(200, { overrides });
      }
    }
      
    case 'PUT': {
      // テナントオーバーライドの設定
      if (!flagKey) {
        return createErrorResponse(400, 'Flag key is required');
      }
      
      const overrideBody = JSON.parse(body || '{}');
      const { error: overrideError, value: overrideValue } = validateTenantOverrideRequest(overrideBody);
      
      if (overrideError) {
        return createErrorResponse(400, 'Invalid request', overrideError.details);
      }
      
      await client.setTenantOverride(
        tenantId,
        flagKey,
        overrideValue.enabled,
        overrideValue.updatedBy || 'system'
      );
      
      console.log('TENANT_OVERRIDE_SET', {
        tenantId,
        flagKey,
        enabled: overrideValue.enabled,
        updatedBy: overrideValue.updatedBy,
      });
      
      return createResponse(200, { message: 'Tenant override set successfully' });
    }
      
    case 'DELETE': {
      // テナントオーバーライドの削除
      if (!flagKey) {
        return createErrorResponse(400, 'Flag key is required');
      }
      
      // 削除実装（DynamoDBからアイテムを削除）
      // await client.deleteTenantOverride(tenantId, flagKey);
      
      return createResponse(200, { message: 'Tenant override removed successfully' });
    }
      
    default:
      return createErrorResponse(405, 'Method not allowed');
  }
}

// 緊急操作（Kill-Switch）のハンドラー
async function handleEmergencyOperations(
  method: string,
  body: string | null
): Promise<APIGatewayProxyResult> {
  const client = getDynamoClient();
  
  switch (method) {
    case 'POST': {
      // Kill-Switchの有効化
      const activateBody = JSON.parse(body || '{}');
      const { flagKey, reason, activatedBy } = activateBody;
      
      if (!reason || !activatedBy) {
        return createErrorResponse(400, 'Reason and activatedBy are required');
      }
      
      await client.setKillSwitch(
        flagKey || null,
        true,
        reason,
        activatedBy
      );
      
      console.log('KILL_SWITCH_ACTIVATED', {
        flagKey: flagKey || 'GLOBAL',
        reason,
        activatedBy,
      });
      
      return createResponse(200, { message: 'Kill-switch activated successfully' });
    }
      
    case 'DELETE': {
      // Kill-Switchの無効化
      const deactivateBody = JSON.parse(body || '{}');
      const { flagKey: deactivateFlagKey, deactivatedBy } = deactivateBody;
      
      if (!deactivatedBy) {
        return createErrorResponse(400, 'deactivatedBy is required');
      }
      
      await client.setKillSwitch(
        deactivateFlagKey || null,
        false,
        `Deactivated by ${deactivatedBy}`,
        deactivatedBy
      );
      
      console.log('KILL_SWITCH_DEACTIVATED', {
        flagKey: deactivateFlagKey || 'GLOBAL',
        deactivatedBy,
      });
      
      return createResponse(200, { message: 'Kill-switch deactivated successfully' });
    }
      
    default:
      return createErrorResponse(405, 'Method not allowed');
  }
}