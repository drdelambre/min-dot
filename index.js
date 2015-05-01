var Base = (typeof window === 'undefined' ? require('mocha').reporters.Base : require('./base')),
    colors = {
        'pending': [37, 39],
        'error': [91, 39],
        'fail': [31, 39],
        'fail-header': [90, 39],
        'pass': [96, 39]
    },
    display = {
        bold: function(str) {
            return '\u001b[1m' + str + '\u001b[0m';
        },
        color: function(str, type) {
            return '\u001b[' + colors[type][0] +
                'm' + str + '\u001b[' + colors[type][1] + 'm';
        },
        print: function(str) {
            process.stdout.write(str);
        }
    };

/**\

    Suite
    represents a node in the tree of test suites

    has_failures [bool] signifies if there are any tests
        that failed in the tree having this node as a root
    draw [string] returns the character representaton of
        this node and it's children 

\**/
function Suite(title) {
    this.title = title;
    this.children = [];
    this.fails = [];
}
Suite.prototype.has_failures = function() {
    if (this.fails.length) {
        return true;
    }

    var ni;
    for (ni = 0; ni < this.children.length; ni++) {
        if (this.children[ni].has_failures()) {
            return true;
        }
    }

    return false;
};
Suite.prototype.draw = function(depth) {
    if (!depth) {
        depth = 0;
    }
    if (!this.has_failures()) {
        return '';
    }

    var title = Array(depth).join('    ') + this.title + '\n',
        out = display.color(title, 'fail-header'),
        ni;

    for (ni = 0; ni < this.fails.length; ni++) {
        out += this.fails[ni].draw(depth + 1);
    }
    for (ni = 0; ni < this.children.length; ni++) {
        out += this.children[ni].draw(depth + 1);
    }

    return out;
};

/**\

    Fail
    An object that is created to preserve information
    about a test failure, and later to display that
    information

    draw [string] returns the character representaton of
        the fail object

\**/
function Fail(title, message) {
    this.title = title;
    this.messege = message;
}
Fail.prototype.draw = function(depth) {
    return display.color(Array(depth).join('    ') + this.title + '\n', 'fail');
};

/**\

    DotMatrix
    Draws the grid of dots for the individual tests with a corresponding
    color for their status [pending|pass|fail].

    returns an object with an interface to the grid
    init [] sets up the terminal and makes the initial grid
    pass [] updates the display with a passing test dot
    fail [] updates the display with a failing test dot
    close [] writes out the summary of the tests to the terminal

\**/
function DotMatrix(total_tests, terminal_width) {
    var tests = [],
        fails = 0,
        passes = 0,
        lines = Math.ceil(total_tests / terminal_width),

        pend_str = display.color('.', 'pending'),
        pass_str = display.color('.', 'pass'),
        err_str = display.color('.', 'error');


    function draw() {
        var left_over = total_tests - tests.length,
            hang_nail = tests.length % terminal_width,
            out, ni;

        out = '\u001b[' + (lines + 1) + 'F';

        for (ni = 0; ni < tests.length; ni++) {
            if (ni !== 0 && ni % terminal_width === 0) {
                out += '\n';
            }
            if (tests[ni]) {
                out += pass_str;
            } else {
                out += err_str;
            }
        }

        for (ni = 0; ni < left_over; ni++) {
            if ((ni + hang_nail) % terminal_width === 0) {
                out += '\n';
            }

            out += pend_str;
        }

        display.print(out + '\n\n');
    }

    return {
        init: function() {
            display.print('\u001b[?25l' + Array(lines + 1).join('\n'));
            draw();
        },
        pass: function() {
            tests.push(true);
            passes++;
            draw();
        },
        fail: function() {
            tests.push(false);
            fails++;
            draw();
        },
        close: function() {
            var last_line = '\u001b[0F\u001b[0C';

            last_line += display.bold(passes) + display.color('passed', 'pending');
            last_line += '  ';
            last_line += display.bold(fails) + display.color('failed', 'pending');
            last_line += '\n';

            display.print(last_line);
        }
    };
}

/**\

    MinDot
    The actual reporter. Ties the runner events to the modules above
    and manages the suite hierarchy for displaying failures at the end

\**/
function MinDot(runner) {
    Base.call(this, runner);

    var dot_matrix = DotMatrix(runner.total, Base.window.width),
        suite_stack = [],
        root_suites = [],
        curr_suite;

    runner.on('start', function() {
        dot_matrix.init();
    });

    runner.on('suite', function(suite) {
        var self = new Suite(suite.title);
        curr_suite = self;
        suite_stack.push(self);
    });

    runner.on('suite end', function() {
        var curr = suite_stack.pop();
        if (!suite_stack.length) {
            root_suites.push(curr);
            curr_suite = null;
        } else {
            curr_suite = suite_stack[suite_stack.length - 1];
            curr_suite.children.push(curr);
        }
    });

    runner.on('pass', function() {
        dot_matrix.pass();
    });

    runner.on('fail', function(test, err) {
        dot_matrix.fail();
        curr_suite.fails.push(new Fail(test.title, err.message));
    });

    runner.on('end', function() {
        dot_matrix.close();

        for (var ni = 0; ni < root_suites.length; ni++) {
            display.print(root_suites[ni].draw());
        }

        display.print('\n\u001b[?25h');
    });
}

exports = module.exports = MinDot;
