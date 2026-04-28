import {LGRemoteClient, LGRemoteKeys} from '../../lib/remote/lg-remote-client';

describe('LGRemoteClient', function () {
  describe('LGRemoteKeys', function () {
    it('should include all original keys', function () {
      LGRemoteKeys.should.have.property('HOME', 'HOME');
      LGRemoteKeys.should.have.property('LEFT', 'LEFT');
      LGRemoteKeys.should.have.property('RIGHT', 'RIGHT');
      LGRemoteKeys.should.have.property('UP', 'UP');
      LGRemoteKeys.should.have.property('DOWN', 'DOWN');
      LGRemoteKeys.should.have.property('ENTER', 'ENTER');
      LGRemoteKeys.should.have.property('BACK', 'BACK');
    });

    it('should include the new MENU key', function () {
      LGRemoteKeys.should.have.property('MENU', 'MENU');
    });
  });

  describe('isConnected', function () {
    it('should return false when WebSocket is not initialized', function () {
      const client = new LGRemoteClient({url: 'ws://192.168.1.1:3000'});
      client.isConnected().should.be.false;
    });
  });
});

