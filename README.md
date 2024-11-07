# Tweet Display Filter

This Tampermonkey userscript allows you to customize the appearance of tweets on X (formerly Twitter) based on user-defined rules.  Apply CSS styles based on the content of tweets, such as author, stats (likes, retweets, views), text content, and more.

## Features

* **Custom CSS Classes:** Define your own CSS classes with specific styles.
* **Rule-Based Styling:** Create rules to apply these classes to tweets based on various criteria.
* **Dynamic Updates:**  Changes to rules and styles are applied in real-time.
* **Persistent Settings:** Your custom rules and classes are saved and loaded automatically.
* **Hideable Menu:**  Discreetly manage your rules with a hideable menu.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or a similar userscript manager) in your browser.
2. Copy the code from `tweet-display-filter.js`.
3. Create a new userscript in Tampermonkey and paste the copied code.
4. Save the script.

## Usage

1. **Open X (Twitter):** Go to [x.com](https://x.com).
2. **Open the Menu:** A small "Show" button will appear in the top-right corner of the page. Click it to open the menu.
3. **Manage CSS Classes:**
    * **Add Class:** Click the "+ Class" button to add a new class.
    * **Edit Class:** Enter the class name and CSS properties in the respective text boxes.
    * **Delete Class:** Click the "×" button to remove a class.
4. **Manage Rules:**
    * **Add Rule:** Click the "+ Rule" button to add a new rule.
    * **Edit Rule:**  
        * **Field:** Select the tweet property to check (author id, likes, text, etc.) from the first dropdown.
        * **Relation:** Select the comparison operator (contains, equals, at least, etc.) from the second dropdown.
        * **Argument:** Enter the value to compare against in the text box.
        * **Classes:**  Enter a comma-separated list of classes to apply if the rule matches.
        * **Enable:** Check the box to enable the rule.
    * **Delete Rule:** Click the "×" button to remove a rule.
5. **Hide the Menu:** Click the "Hide" button to collapse the menu, keeping your customizations active.


## Example Rules

Here are a few examples to get you started:

* **Blur Tweets with Many Likes:**
    * Field: `likes`
    * Relation: `at least`
    * Argument: `100`
    * Classes: `blur-popular`
    * CSS Class `blur-popular`: `filter: blur(0.5px);`

* **Hide Tweets from a Specific User:**
    * Field: `id`
    * Relation: `equals`
    * Argument: `@annoyinguser`
    * Classes: `hidden-tweet`
    * CSS Class `hidden-tweet`: `display: none;`


## Supported Fields

* `id`: The author's Twitter handle (e.g., @username).
* `views`: The number of views the tweet has received.
* `likes`: The number of likes the tweet has received.
* `retweets`: The number of retweets the tweet has received.
* `replies`: The number of replies the tweet has received.
* `text`: The text content of the tweet.
* `date`: The date the tweet was posted. It is of the form *Month Day* or, for recent tweets, *Number[smhd]*, where s, m, h, d corresponds to seconds, minutes, hours, and days respectively, the number representing how long ago it was since the tweet was posted.
* `images`:  An array of image URLs included in the tweet.
* `reposter id`:  The Twitter handle of the user who reposted the tweet.


## Supported Relations

* `contains`: Checks if the field contains the argument (case-insensitive).
* `doesn't contain`: Checks if the field does *not* contain the argument (case-insensitive).
* `equals`: Checks if the field is exactly equal to the argument.
* `doesn't equal`: Checks if the field is *not* exactly equal to the argument.
* `at least`: Checks if the field is greater than or equal to the argument (numeric fields only).
* `at most`: Checks if the field is less than or equal to the argument (numeric fields only).
* `exists`: Checks if the field has a value. Checks if array-valued fields are nonempty for array fields
* `doesn't exist`: Checks if the field is does not have a value, or is an empty array.

## License

[MIT](LICENSE)