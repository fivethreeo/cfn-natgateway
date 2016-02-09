
var AWS = require('aws-sdk');
var CfnLambda = require('cfn-lambda');

var EC2 = new AWS.EC2({apiVersion: '2015-01-01'});
var Lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

var Delete = CfnLambda.SDKAlias({
  api: EC2,
  method: 'deleteNatGateway',
  ignoreErrorCodes: [404, 409],
  keys: ['NatGatewayId'],
  physicalIdAs: 'NatGatewayId', 
  returnPhysicalId: getPhysicalIdDelete
});

var BoolProperties = [
];

var NumProperties = [
];

var Create = CfnLambda.SDKAlias({
  api: EC2,
  method: 'createNatGateway',
  forceBools: BoolProperties,
  forceNums: NumProperties,
  keys: ['SubnetId', 'AllocationId'],
  returnPhysicalId: getPhysicalId
});

function getPhysicalId(data, params) {
  return data.NatGateway.NatGatewayId
}

function getPhysicalIdDelete(data, params) {
  return data.NatGatewayId
}

exports.handler = CfnLambda({
  Create: Create,
  Update: Create,
  Delete: Delete,
  NoUpdate: NoUpdate,
  TriggersReplacement: ['SubnetId', 'AllocationId'],
  SchemaPath: [__dirname, 'schema.json'],
  LongRunning: {
    PingInSeconds: 60,
    MaxPings: 10,
    LambdaApi: Lambda,
    Methods: {
      Create: CheckCreate,
      Update: CheckUpdate,
      Delete: CheckDelete
    }
  }
});

function CheckProcessComplete(params, physicalId, reply, notDone) {
  EC2.describeNatGateways({
    NatGatewayIds: [physicalId],
    MaxResults: 5
  }, function(err, data) {
    if (err) {
      console.error('Error when pinging for Processing Complete: %j', err);
      return reply(err.message);
    }
    if (data.NatGateways[0].State == "failed") {
      console.error('Nat gateway failed to create: %j', data.NatGateways[0].FailureMessage);
      return reply(data.NatGateways[0].FailureMessage);
    }
    if (data.NatGateways[0].State == "pending") {
      console.log('Status is not State: available yet. Ping not done: %j', data);
      return notDone();
    }
    console.log('Status is Processing: false! %j', data);
    reply(null, physicalId, data.NatGateways[0].NatGatewayAddresses[0]);
  });
}

function CheckCreate(createReponse, params, reply, notDone) {
  CheckProcessComplete(params, createReponse.PhysicalResourceId, reply, notDone);
}

function CheckUpdate(updateResponse, physicalId, params, oldParams, reply, notDone) {
  CheckProcessComplete(params, physicalId, reply, notDone);
}

function CheckDelete(deleteResponse, physicalId, params, reply, notDone) {
  EC2.describeNatGateways({
    NatGatewayIds: [physicalId],
    MaxResults: 5
  }, function(err, data) {
    if (err && (err.statusCode === 404 || err.statusCode === 409)) {
      console.log('Got a 404 on delete check, implicit Delete SUCCESS: %j', err);
      return reply(null, physicalId);
    }
    if (err) {
      console.error('Error when pinging for Delete Complete: %j', err);
      return reply(err.message);
    }
    if (data.NatGateways[0].State == "deleting") {
      console.log('Status is not Deleted yet. Ping not done: %j', data);
      return notDone();
    }
    console.log('Status is Deleted! %j', data);
    reply(null, physicalId);
  });
}

function NoUpdate(phys, params, reply) {
  EC2.describeNatGateways({
    NatGatewayIds: [phys],
    MaxResults: 1
  }, function(err, data) {
    if (err) {
      console.error('Error when pinging for NoUpdate Attrs: %j', err);
      return reply(err.message);
    }
    console.log('NoUpdate pingcheck success! %j', data);
    reply(null, phys, data.NatGateways[0].NatGatewayAddresses.NatGatewayAddresses[0]);
  });
}
