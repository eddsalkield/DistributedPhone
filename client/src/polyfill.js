if(!Promise.prototype.finally) {
    Promise.prototype.finally = function(onFinally) {
        if(onFinally === null || onFinally === undefined) {
            return this.then();
        }
        return this.then(function(value) {
            return Promise.resolve(onFinally()).then(function() {
                return value;
            });
        }, function(error) {
            return Promise.resolve(onFinally()).then(function() {
                throw error;
            });
        });
    }
}

if(self.document) {
    self.document.write = function() {
        throw new Error("document.open() is bad");
    }
    self.document.open = function() {
        throw new Error("document.open() is bad");
    }
    self.document.close = function() {
        throw new Error("document.open() is bad");
    }
}
