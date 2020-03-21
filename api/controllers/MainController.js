/**
 * MainController
 *
 * @description :: Server-side actions for handling incoming requests.
 * @help        :: See https://sailsjs.com/docs/concepts/actions
 */

const axios = require('axios');

module.exports = {
  /**
   * Start sharing your account
   *
   * @param {*} req
   * @param {*} res
   */
  share: function(req, res) {
    User.updateOne({id: req.user.id})
      .set({public: true})
      .then(user => {
        return res.send({'key': user.key});
      });
  },

  /**
   * Make account private
   *
   * @param {*} req
   * @param {*} res
   */
  unshare: function(req, res) {
    User.updateOne({id: req.user.id})
      .set({public: false})
      .then(() => {
        return res.send({message: 'ok'});
      });
  },

  /**
   * Play a the user 'user_key' is playing on the 'device_id' of the logged user
   *
   * @param {*} req
   * @param {*} res
   */
  play: function(req, res) {
    let userKey = req.param('user_key', null);
    let deviceId = req.param('device_id', null);

    if(!userKey || !deviceId) {
      return res.status(401).send({message: 'Wrong parameters'});
    }

    // Find user by key
    User.findOne({key: userKey})
      .then(async targetUser =>  {
        if(!targetUser) {
          return res.status(401).json({message: 'User not found'});
        }

        // Ensure fresh token
        targetUser = await sails.helpers.getValidToken.with({user: targetUser});
        loggedUser = await sails.helpers.getValidToken.with({user: req.user});

        let getCurrentlyPlayingUrl = 'https://api.spotify.com/v1/me/player/currently-playing';
        let options = {headers: {
          Authorization: 'Bearer ' + targetUser.accessToken,
        }};

        // Get what the target user is listening
        axios.get(getCurrentlyPlayingUrl, options)
          .then(response => {
            if(!response.data) {
              return res.status(412).send({
                message: 'Something went wrong, cannot get currently playing song',
                type: 'USER_NOT_ONLINE'
              });
            }

            let getUserProfileUrl = 'https://api.spotify.com/v1/me';
            let options = {headers: {
              Authorization: 'Bearer ' + targetUser.accessToken,
            }};

            // Get target user profile
            axios.get(getUserProfileUrl, options)
              .then((userProfile) => {
                let songUri = response.data.item.uri;
                let playUri = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
                let config = JSON.stringify({uris: [songUri]});
                let options = { headers: {
                  Authorization: 'Bearer ' + req.user.accessToken,
                }};

                // Play song for logged user on given device id
                axios.put(playUri, config, options)
                  .then(() => {
                    let profilePicUrl = userProfile.data.images.lenght ? userProfile.data.images.slice(-1).pop().url : null;
                    return res.json({name: userProfile.data.display_name, 'profile_pic_url': profilePicUrl});
                  })
                  .catch(err => {
                    let message = 'Something went wrong, cannot play the song, is Mirra Web Player running?';
                    return res.status(500).send({message: message, error: err.response.statusText});
                  });
              })
              .catch(err => {
                let message = 'Something went wrong, cannot get user info';
                return res.status(500).send({message: message, error: err.response.statusText});
              });
          })
          .catch(err => {
            let message = 'Something went wrong, cannot get currently playing song';
            return res.status(500).json({message: message, error: err.response.statusText});
          });
      });
  }
};
