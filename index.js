
var AWS = require('aws-sdk');
var CfnLambda = require('cfn-lambda');

var EC2 = new AWS.EC2({apiVersion: '2015-01-01'});
var Lambda = new AWS.Lambda({apiVersion: '2015-03-31'});

var Delete = CfnLambda.SDKAlias({
  api: EC2,
  method: 'deleteNatGateway',
  ignoreErrorCodes: [404, 409],
  keys: ['SubnetId', 'AllocationId'],
  returnPhysicalId: getPhysicalId
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
  returnPhysicalId: getPhysicalId
});

var Update = CfnLambda.SDKAlias({ // Won't be triggered, but is required
  api: EC2,
  method: 'createNatGateway',
  forceBools: BoolProperties,
  forceNums: NumProperties,
  returnPhysicalId: getPhysicalId
});

function getPhysicalId(data, params) {
  return CfnLambda.Environment.AccountId + '/' + params.SubnetId + '/' + params.AllocationId;
}

exports.handler = CfnLambda({
  Create: Create,
  Update: NoUpdate,
  Delete: Delete,
  NoUpdate: NoUpdate,
  TriggersReplacement: ['SubnetId', 'AllocationId'],
  SchemaPath: [__dirname, 'schema.json'],
  LongRunning: {
    PingInSeconds: 180,
    MaxPings: 15,
    LambdaApi: Lambda,
    Methods: {
      Create: CheckCreate,
      Update: CheckUpdate,
      Delete: CheckDelete
    }
  }
});

function CheckProcessComplete(params, reply, notDone) {
  EC2.describeNatGateways({
    Filter: [{
      Name: 'subnet-id',
      Values:[params.SubnetId]
    }],
    MaxResults: 1,
    NatGatewayIds: [getPhysicalId({}, params)]
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
      console.log('Status is not Processing: false yet. Ping not done: %j', data);
      return notDone();
    }
    console.log('Status is Processing: false! %j', data);
    reply(null, data.NatGateways[0].NatGatewayId, {
    });
  });
}

function CheckCreate(createReponse, params, reply, notDone) {
  CheckProcessComplete(params, reply, notDone);
}

function CheckUpdate(updateResponse, physicalId, params, oldParams, reply, notDone) {
  CheckProcessComplete(params, reply, notDone);
}

function CheckDelete(deleteResponse, physicalId, params, reply, notDone) {
  EC2.describeNatGateways({
    Filter: [{
      Name: 'subnet-id',
      Values:[params.SubnetId]
    }],
    MaxResults: 1,
    NatGatewayIds: [getPhysicalId({}, params)]
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
    reply(null, data.NatGateways[0].NatGatewayId);
  });
}

function NoUpdate(phys, params, reply) {
  EC2.describeElasticsearchDomain({
    Filter: [{
      Name: 'subnet-id',
      Values:[params.SubnetId]
    }],
    MaxResults: 1,
    NatGatewayIds: [getPhysicalId({}, params)]
  }, function(err, data) {
    if (err) {
      console.error('Error when pinging for NoUpdate Attrs: %j', err);
      return reply(err.message);
    }
    console.log('NoUpdate pingcheck success! %j', data);
    reply(null, data.NatGateways[0].NatGatewayId, {
    });
  });
}
