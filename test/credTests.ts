// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { CognitiveServicesCredentials } from '../lib/credentials/cognitiveServicesCredentials';

describe('CognitiveServices credentials', function () {
  it('should set subscriptionKey properly in request', async function () {
    const creds = new CognitiveServicesCredentials('123-456-7890');
    const request: any = {
      headers: {}
    };

    await creds.signRequest(request);
    request.headers.should.have.property('Ocp-Apim-Subscription-Key');
    request.headers.should.have.property('X-BingApis-SDK-Client');
    request.headers['Ocp-Apim-Subscription-Key'].should.match(new RegExp('^123\-456\-7890$'));
    request.headers['X-BingApis-SDK-Client'].should.match(new RegExp('^node\-SDK$'));
  });
});
