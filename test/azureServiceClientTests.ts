// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import should = require('should');
import * as assert from "assert";
import * as msRest from 'ms-rest-js';
import { AzureServiceClient } from '../lib/azureServiceClient';
import Constants from '../lib/util/constants';
import { RequestPolicyCreator } from 'ms-rest-js/typings/lib/policies/requestPolicy';

const LroStates = Constants.LongRunningOperationStates;
const credentials = new msRest.TokenCredentials('clientId');

describe('AzureServiceClient', function () {
  describe('Constructor intialization', function () {
    it('should intialize with credentials only', function (done) {
      (new AzureServiceClient(credentials)).should.not.throw();
      done();
    });

    it('should intialize with credentials and request options', function (done) {
      const clientOptions: any = {};
      clientOptions.requestOptions = { jar: true };
      clientOptions.filters = [msRest.exponentialRetryPolicy(3, 0.0001, 0.0001, 0.0001)];
      clientOptions.noRetryPolicy = true;
      (new AzureServiceClient(credentials, clientOptions)).should.not.throw();
      done();
    });
  });

  describe('Lro', function () {

    var testResourceName = 'foo';
    var testError = 'Lro error for you';
    var testCustomFieldValue = 'CustomField123';
    var urlFromAzureAsyncOPHeader_Return200 = 'http://dummyurlFromAzureAsyncOPHeader_Return200';
    var urlFromLocationHeader_Return200 = 'http://dummyurlurlFromLocationHeader_Return200';
    var url_ReturnError = 'http://dummyurl_ReturnError';
    var url_resource = 'http://subscriptions/sub1/resourcegroups/g1/resourcetype1/resource1';

    var resultOfInitialRequest: any = {
      response: {
        headers: {},
      },
      body: {
        properties: {
          provisioningState: LroStates.InProgress
        }
      },
      request: { url: url_resource }
    };

    var mockedGetStatus = function (this: any, url: string, callback: Function) {
      if (url === urlFromAzureAsyncOPHeader_Return200) {
        return callback(null, {
          response: {
            randomFieldFromPollAsyncOpHeader: ''
          },
          body: { status: 'Succeeded' },
          request: { "url": url }
        });
      } if (url === urlFromLocationHeader_Return200) {
        return callback(null, {
          response: {
            statusCode: 200,
            randomFieldFromPollLocationHeader: '',
            testCustomField: this._options ? this._options.customHeaders['testCustomField'] : null
          },
          body: {
            status : LroStates.Succeeded,
            'name': testResourceName
          },
          request: { "url": url }
        });
      } else if (url === url_ReturnError) {
        return callback({ message: testError });
      } else if (url === url_resource) {
        return callback(null, {
          body: {
            status : LroStates.Succeeded,
            'name': testResourceName
          }
        });
      } else {
        throw new Error('The given url does not match the expected url');
      }
    };

    const client = new AzureServiceClient(credentials, { longRunningOperationRetryTimeout : 0 });
    (client as any).getStatus = mockedGetStatus;

    describe('Put', function () {
      resultOfInitialRequest.response.statusCode = 201;
	    resultOfInitialRequest.request.method = 'PUT';

      it('throw on not Lro related status code', async function () {
        try {
          await client.getLongRunningOperationResult({
            status: 10000,
            headers: new msRest.HttpHeaders(),
            request: new msRest.WebResource("http://foo", 'PUT')
          });
          assert.fail('');
        } catch (err) {
          err.should.not.be.instanceof(assert.AssertionError);
          err.message.should.containEql('Unexpected polling status code from long running operation');
        }
      });

      it('works by polling from the azure-asyncoperation header', async function () {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = urlFromAzureAsyncOPHeader_Return200;
        resultOfInitialRequest.response.headers['location'] = '';
        const result = await client.getLongRunningOperationResult(resultOfInitialRequest);
        result.parsedBody.name.should.equal(testResourceName);
      });

      it('works by accepting custom headers', async function () {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
        var options = {
          customHeaders : {
            'testCustomField': testCustomFieldValue
          }
        };

        const result = await client.getLongRunningOperationResult(resultOfInitialRequest, options);
        result.parsedBody.name.should.equal(testResourceName);
        should(result.headers.get("testCustomField")).equal(testCustomFieldValue);
      });

      it('works by polling from the location header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any, result: any) {
          should.not.exist(err);
          JSON.parse(result.body).name.should.equal(testResourceName);
          should.exist(result.response.randomFieldFromPollLocationHeader);
          done();
        });
      });

      it('returns error if failed to poll from the azure-asyncoperation header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = url_ReturnError;
        resultOfInitialRequest.response.headers['location'] = '';
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          err.message.should.containEql(testError);
          done();
        });
      });

      it('returns error if failed to poll from the location header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = url_ReturnError;
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          err.message.should.containEql(testError);
          done();
        });
      });
    });

	describe('Patch', function () {
	  resultOfInitialRequest.response.statusCode = 202;
	  resultOfInitialRequest.body.properties.provisioningState = LroStates.Succeeded;
	  resultOfInitialRequest.request.method = 'PATCH';

	  it('works by polling from location header', function (done) {
	    resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
		client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any, result: any) {
          should.not.exist(err);
          JSON.parse(result.body).name.should.equal(testResourceName);
		  should.exist(result.response.randomFieldFromPollLocationHeader);
          done();
        });
	  });

	  it('works by polling from azure-asyncoperation header', function (done) {
	    resultOfInitialRequest.response.headers['azure-asyncoperation'] = urlFromAzureAsyncOPHeader_Return200;
		resultOfInitialRequest.response.headers['location'] = '';
		client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any, result: any) {
          should.not.exist(err);
          JSON.parse(result.body).name.should.equal(testResourceName);
          done();
        });
	  });

	  it('returns error if failed to poll from the azure-asyncoperation header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = url_ReturnError;
        resultOfInitialRequest.response.headers['location'] = '';
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          err.message.should.containEql(testError);
          done();
        });
      });

	  it('returns error if failed to poll from the location header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = url_ReturnError;
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          err.message.should.containEql(testError);
          done();
        });
      });
	});

    describe('Post-or-Delete', function () {
      resultOfInitialRequest.response.statusCode = 202;
      resultOfInitialRequest.body.properties.provisioningState = LroStates.Succeeded;

      it('throw on not Lro related status code', function (done) {
        client.getLongRunningOperationResult({ status: 201, headers: new msRest.HttpHeaders(), request: new msRest.WebResource(url_resource, 'POST') }, function (err: any) {
          err.message.should.containEql('Unexpected polling status code from long running operation');
          done();
        });
      });

      it('works by polling from the azure-asyncoperation header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = urlFromAzureAsyncOPHeader_Return200;
        resultOfInitialRequest.response.headers['location'] = '';
		resultOfInitialRequest.request.method = 'POST';
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any, result: any) {
          should.not.exist(err);
          should.exist(result.response.randomFieldFromPollAsyncOpHeader);
          done();
        });
      });

      it('works by polling from the location header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any, result: any) {
          should.not.exist(err);
          should.exist(result.response.randomFieldFromPollLocationHeader);
          JSON.parse(result.body).name.should.equal(testResourceName);
          done();
        });
      });

      it('returns error if failed to poll from the azure-asyncoperation header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = url_ReturnError;
        resultOfInitialRequest.response.headers['location'] = '';
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          err.message.should.containEql(testError);
          done();
        });
      });

      it('returns error if failed to poll from the location header', function (done) {
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = url_ReturnError;
        client.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          err.message.should.containEql(testError);
          done();
        });
      });
    });

    describe('Negative tests for status deserialization', function () {
      const mockFilter = (response: any, responseBody: any): RequestPolicyCreator =>
        () => ({
          sendRequest: () => ({ ...response, bodyAsText: responseBody } as any)
        });

      it('lro put does not throw if invalid json is received on polling', function (done) {
        var badResponseBody = '{';
        var negativeClient = new AzureServiceClient(credentials, {
          longRunningOperationRetryTimeout : 0,
          requestPolicyCreators: [
            mockFilter({ statusCode: 200, body: badResponseBody }, badResponseBody)
          ]
        });
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
        negativeClient.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          should.exist(err);
          should.exist(err.response);
          should.exist(err.message);
          err.message.should.match(/^Long running operation failed with error: "Error.*occurred in deserializing the response body.*/ig);
          done();
        });
      });

      it('lro put does not throw if invalid json with single quote is received on polling', async function () {
        var badResponseBody = '{\'"}';
        var negativeClient = new AzureServiceClient(credentials, {
          longRunningOperationRetryTimeout : 0,
          requestPolicyCreators: [
            mockFilter({ statusCode: 200, body: badResponseBody }, badResponseBody)
          ]
        });
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
        try {
          await negativeClient.getLongRunningOperationResult(resultOfInitialRequest, (negativeClient as any).getStatus)
        } catch (err) {
          should.exist(err);
          should.exist(err.response);
          should.exist(err.message);
          err.message.should.match(/^Long running operation failed with error: "Error.*occurred in deserializing the response body.*/ig);
        }
      });

      it('lro put does not throw if invalid json is received with invalid status code on polling', function (done) {
        var badResponseBody = '{';
        var negativeClient = new AzureServiceClient(credentials, {
          longRunningOperationRetryTimeout : 0,
          requestPolicyCreators: [
            mockFilter({ statusCode: 203, body: badResponseBody }, badResponseBody)
          ]
        });
        resultOfInitialRequest.response.headers['azure-asyncoperation'] = '';
        resultOfInitialRequest.response.headers['location'] = urlFromLocationHeader_Return200;
        negativeClient.getLongRunningOperationResult(resultOfInitialRequest, function (err: any) {
          should.exist(err);
          should.exist(err.response);
          should.exist(err.message);
          err.message.should.match(/^Long running operation failed with error:/ig);
          err.message.should.match(/.*Could not deserialize error response body - .*/ig);
          done();
        });
      });
    });

  });
});