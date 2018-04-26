import cherrypy, subprocess

class flashserver(object):
    @cherrypy.expose
    def default(self, *args, **kwargs):
        subprocess.call(['./gitpull.sh'])
        return "Success"

if __name__ == '__main__':
   cherrypy.config.update({'server.socket_host': '0.0.0.0',
                           'server.socket_port': 8081,
                           })



   cherrypy.quickstart(flashserver())
