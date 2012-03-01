Waffles.js
==========
Very early playground for a spreadsheet using coffeescript macros, because hey, why not.

Setup
-----
Run the default rake task to generate the js file, then open "www/test.html".

Macros
------
Some macro examples:

    =SUM(A:A) # Sums all values in the 'A' column
    =Math.pow(A1, A2) # Takes the value of A1, to the power of A2.

There's no handling of circular references atm, so be careful!

